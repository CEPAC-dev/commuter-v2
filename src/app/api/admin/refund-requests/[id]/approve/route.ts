import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { RefundRequest } from "@/models/RefundRequest";
import { Trip } from "@/models/Trip";
import { Payment } from "@/models/Payment";
import { Request } from "@/models/Request";
import { WalletTransaction } from "@/models/WalletTransaction";
import { Log } from "@/models/Log";
import { Types } from "mongoose";
import {
  disburseLegacyWalletRefund,
  disburseTripRefund,
} from "@/lib/payments/refundDisbursement";
import { reconcileRequestSummary } from "@/lib/payments/requestReconciliation";

type ClaimedRefundRequest = {
  _id: { toString(): string };
  tripId: mongoose.Types.ObjectId;
  passengerId: mongoose.Types.ObjectId;
  refundAmount: number;
  tier: string;
};

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();
  const refundRequest = await RefundRequest.findById(id).lean();
  if (!refundRequest) {
    return NextResponse.json(
      { error: "Refund request not found or has already been reviewed." },
      { status: 409 },
    );
  }

  const trip = await Trip.findById(refundRequest.tripId).lean<{
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    requestId?: Types.ObjectId | null;
    priceEgp: number;
    status: string;
    paymentStatus: string;
    adminRefund?: {
      status?: string;
      refundAmountEgp?: number;
      compensationAmountEgp?: number;
      retryAllowed?: boolean;
    } | null;
  } | null>();
  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  const bookingId = trip.requestId ?? trip._id;
  const payment = await Payment.findOne({
    bookingId,
    overallStatus: { $in: ["paid", "partially_refunded"] },
  })
    .sort({ createdAt: -1 })
    .lean();
  if (!payment) {
    const parentRequest = trip.requestId
      ? await Request.findById(trip.requestId)
          .select("status paymentStatus amountEgp")
          .lean<{
            status: string;
            paymentStatus: string;
            amountEgp: number;
          } | null>()
      : null;
    const legacyPaid =
      trip.paymentStatus === "paid" ||
      parentRequest?.paymentStatus === "paid" ||
      parentRequest?.paymentStatus === "partially_refunded";
    if (!legacyPaid || refundRequest.status !== "pending") {
      return NextResponse.json(
        {
          error:
            "A settled Payment record or a paid legacy Request is required.",
        },
        { status: 409 },
      );
    }
    const amountEgp = Number(refundRequest.refundAmount);
    if (
      !Number.isSafeInteger(amountEgp) ||
      amountEgp < 0 ||
      amountEgp > trip.priceEgp
    ) {
      return NextResponse.json(
        { error: "Refund exceeds the remaining Trip amount." },
        { status: 409 },
      );
    }
    const claimedLegacyRequest = await RefundRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      {
        $set: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: session.userId,
        },
      },
      { returnDocument: "after" },
    ).lean<ClaimedRefundRequest | null>();
    if (!claimedLegacyRequest) {
      return NextResponse.json(
        { error: "Refund request not found or has already been reviewed." },
        { status: 409 },
      );
    }

    const bookingId = String(trip.requestId ?? trip._id);
    const operationId = `legacy:${bookingId}:${trip._id}`;
    let legacyRefund;
    try {
      legacyRefund = await disburseLegacyWalletRefund({
        operationId,
        userId: String(claimedLegacyRequest.passengerId),
        bookingId,
        tripId: String(trip._id),
        amountEgp,
        reason: `Passenger cancellation (${claimedLegacyRequest.tier})`,
      });
    } catch (error) {
      await RefundRequest.updateOne(
        { _id: id, status: "approved", reviewedBy: session.userId },
        {
          $set: { status: "pending" },
          $unset: { reviewedAt: 1, reviewedBy: 1 },
        },
      );
      throw error;
    }

    await Trip.updateOne(
      { _id: trip._id },
      {
        $set: {
          "cancellation.refundStatus": "approved",
          ...(legacyRefund.amountEgp >= trip.priceEgp
            ? { paymentStatus: "refunded" }
            : {}),
        },
      },
    );
    if (trip.requestId && parentRequest) {
      const requestRefunds = await WalletTransaction.aggregate<{
        amountEgp: number;
      }>([
        {
          $match: {
            bookingId: trip.requestId,
            type: "refund",
            status: "completed",
          },
        },
        { $group: { _id: null, amountEgp: { $sum: "$amountEgp" } } },
      ]);
      const totalRefunded = requestRefunds[0]?.amountEgp ?? 0;
      await Request.updateOne(
        { _id: trip.requestId },
        {
          $set: {
            paymentStatus:
              totalRefunded >= parentRequest.amountEgp
                ? "refunded"
                : "partially_refunded",
          },
        },
      );
      await reconcileRequestSummary(String(trip.requestId));
    }
    await Log.create({
      actor: session.userId,
      actorType: "admin",
      action: "refund_request_approved",
      target: String(claimedLegacyRequest._id),
      targetType: "refund_request",
      details: {
        tripId: trip._id,
        passengerId: claimedLegacyRequest.passengerId,
        refundAmount: amountEgp,
        tier: claimedLegacyRequest.tier,
        legacyWalletRefund: true,
      },
    });
    return NextResponse.json({
      success: true,
      message: `Legacy refund approved. ${legacyRefund.amountEgp} EGP credited to the passenger wallet.`,
      refundRequest: claimedLegacyRequest,
    });
  }
  const isRetry =
    refundRequest.status === "approved" &&
    trip.adminRefund?.status === "failed" &&
    trip.adminRefund.retryAllowed === true;
  if (refundRequest.status !== "pending" && !isRetry) {
    return NextResponse.json(
      { error: "This refund is not pending or safely retryable." },
      { status: 409 },
    );
  }

  const now = new Date();
  const refundLockToken = new Types.ObjectId().toString();
  const staleLockCutoff = new Date(now.getTime() - 5 * 60_000);
  const cooldownCutoff = new Date(now.getTime() - 60_000);
  const lockedPayment = await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      $and: [
        {
          $or: [
            { refundLock: null },
            { refundLock: { $exists: false } },
            { "refundLock.acquiredAt": { $lte: staleLockCutoff } },
          ],
        },
        {
          $or: [
            { lastRefundAttemptAt: null },
            { lastRefundAttemptAt: { $exists: false } },
            { lastRefundAttemptAt: { $lte: cooldownCutoff } },
          ],
        },
      ],
    },
    {
      $set: {
        refundLock: { token: refundLockToken, acquiredAt: now },
        lastRefundAttemptAt: now,
      },
    },
    { returnDocument: "after" },
  );
  if (!lockedPayment) {
    return NextResponse.json(
      { error: "A refund is already being processed for this Payment." },
      { status: 409 },
    );
  }

  let claimedRequest: ClaimedRefundRequest | null = null;
  try {
    claimedRequest = isRetry
      ? (refundRequest as unknown as ClaimedRefundRequest)
      : await RefundRequest.findOneAndUpdate(
          { _id: id, status: "pending" },
          {
            $set: {
              status: "approved",
              reviewedAt: now,
              reviewedBy: session.userId,
            },
          },
          { returnDocument: "after" },
        ).lean<ClaimedRefundRequest | null>();
    if (!claimedRequest) {
      return NextResponse.json(
        { error: "Refund request not found or has already been reviewed." },
        { status: 409 },
      );
    }

    const alreadyRefunded = payment.refundedAmountEgp ?? 0;
    const tripRefunded = trip.adminRefund?.refundAmountEgp ?? 0;
    const amountEgp = Number(claimedRequest.refundAmount) - tripRefunded;
    if (
      !Number.isSafeInteger(amountEgp) ||
      amountEgp < 0 ||
      amountEgp > payment.totalEgp - alreadyRefunded ||
      amountEgp > trip.priceEgp - tripRefunded
    ) {
      await RefundRequest.updateOne(
        { _id: id, status: "approved", reviewedBy: session.userId },
        {
          $set: { status: "pending" },
          $unset: { reviewedAt: 1, reviewedBy: 1 },
        },
      );
      claimedRequest = null;
      return NextResponse.json(
        {
          error:
            "Refund exceeds the remaining refundable Payment or Trip amount.",
        },
        { status: 409 },
      );
    }

    const operationId = `${payment._id}:${trip._id}:${tripRefunded}`;
    const previousCompensation = trip.adminRefund?.compensationAmountEgp ?? 0;
    await Trip.updateOne(
      { _id: trip._id },
      {
        $set: {
          adminRefund: {
            status: "processing",
            paymentId: payment._id,
            refundOperationId: operationId,
            refundedBy: new Types.ObjectId(session.userId),
            refundAmountEgp: tripRefunded,
            gatewayRefundAmountEgp: 0,
            compensationPercent: 0,
            compensationAmountEgp: previousCompensation,
            totalReturnEgp: tripRefunded + previousCompensation,
            reason: `Passenger cancellation: ${claimedRequest.tier}`,
            retryAllowed: false,
          },
          "cancellation.refundStatus": "pending",
        },
      },
    );

    const disbursement = await disburseTripRefund({
      operationId,
      payment,
      tripId: String(trip._id),
      amountEgp,
      reason: `Passenger cancellation (${claimedRequest.tier})`,
    });
    const confirmedRefundEgp =
      disbursement.walletRefundEgp + disbursement.confirmedGatewayRefundEgp;
    const refundLedger = await WalletTransaction.aggregate<{
      _id: string;
      amountEgp: number;
    }>([
      {
        $match: {
          paymentId: payment._id,
          status: "completed",
          type: { $in: ["refund", "payment_refund_partial"] },
        },
      },
      { $group: { _id: "$type", amountEgp: { $sum: "$amountEgp" } } },
    ]);
    const walletRefundedTotal =
      refundLedger.find((entry) => entry._id === "refund")?.amountEgp ?? 0;
    const gatewayRefundedTotal =
      refundLedger.find((entry) => entry._id === "payment_refund_partial")
        ?.amountEgp ?? 0;
    const refundedAmountEgp = Math.min(
      payment.totalEgp,
      walletRefundedTotal + gatewayRefundedTotal || alreadyRefunded,
    );
    const paymentFullyRefunded = refundedAmountEgp >= payment.totalEgp;
    const tripRefundLedger = await WalletTransaction.aggregate<{
      amountEgp: number;
    }>([
      {
        $match: {
          paymentId: payment._id,
          tripId: trip._id,
          status: "completed",
          type: { $in: ["refund", "payment_refund_partial"] },
        },
      },
      { $group: { _id: null, amountEgp: { $sum: "$amountEgp" } } },
    ]);
    const tripRefundedTotal = tripRefundLedger[0]?.amountEgp ?? tripRefunded;
    const tripFullyRefunded = tripRefundedTotal >= trip.priceEgp;

    await Payment.updateOne(
      { _id: payment._id, "refundLock.token": refundLockToken },
      {
        $set: {
          ...(confirmedRefundEgp > 0
            ? {
                refundedAt: now,
                refundedAmountEgp,
                overallStatus: paymentFullyRefunded
                  ? "refunded"
                  : "partially_refunded",
              }
            : {}),
          ...(disbursement.walletCapturedEgp > 0 &&
          walletRefundedTotal >= disbursement.walletCapturedEgp
            ? { walletStatus: "refunded" }
            : {}),
          ...(payment.gatewayAmountEgp > 0 &&
          gatewayRefundedTotal >= payment.gatewayAmountEgp
            ? { gatewayStatus: "refunded" }
            : {}),
        },
        $addToSet: {
          ...(disbursement.walletRefundTxId
            ? { walletRefundTxIds: disbursement.walletRefundTxId }
            : {}),
          ...(disbursement.kashierRefundId
            ? { kashierRefundIds: disbursement.kashierRefundId }
            : {}),
        },
        $push: {
          timeline: {
            $each: [
              ...disbursement.timelineEvents,
              {
                event: "passenger_cancellation_refund_approved",
                detail: `${confirmedRefundEgp} EGP confirmed for Trip ${trip._id}`,
                actor: "admin",
              },
            ],
          },
        },
      },
    );

    await Trip.updateOne(
      { _id: trip._id, "adminRefund.refundOperationId": operationId },
      {
        $set: {
          "adminRefund.status": disbursement.gatewayRefundPending
            ? "processing"
            : disbursement.gatewayRefundFailed
              ? "failed"
              : "completed",
          "adminRefund.refundAmountEgp": tripRefundedTotal,
          "adminRefund.gatewayRefundAmountEgp": disbursement.gatewayRefundEgp,
          "adminRefund.totalReturnEgp":
            tripRefundedTotal + previousCompensation,
          "adminRefund.retryAllowed": disbursement.gatewayRefundRetrySafe,
          ...(disbursement.attemptedKashierRefundId
            ? {
                "adminRefund.kashierRefundId":
                  disbursement.attemptedKashierRefundId,
              }
            : {}),
          "cancellation.refundStatus":
            disbursement.gatewayRefundPending ||
            disbursement.gatewayRefundFailed
              ? "pending"
              : "approved",
          ...(tripFullyRefunded && !disbursement.gatewayRefundPending
            ? { paymentStatus: "refunded" }
            : {}),
          ...(disbursement.gatewayRefundFailed
            ? {
                "adminRefund.failureReason":
                  "Kashier refund failed; retry is safe",
              }
            : disbursement.gatewayRefundPending
              ? {
                  "adminRefund.failureReason":
                    "Kashier refund outcome requires reconciliation",
                }
              : {}),
        },
      },
    );

    if (trip.requestId) {
      await reconcileRequestSummary(String(trip.requestId));
    }
    await Log.create({
      actor: session.userId,
      actorType: "admin",
      action: "refund_request_approved",
      target: String(claimedRequest._id),
      targetType: "refund_request",
      details: {
        tripId: trip._id,
        passengerId: claimedRequest.passengerId,
        refundAmount: amountEgp,
        confirmedRefundEgp,
        tier: claimedRequest.tier,
      },
    });

    return NextResponse.json({
      success: true,
      message: disbursement.gatewayRefundPending
        ? "Refund approved; Kashier confirmation is pending."
        : disbursement.gatewayRefundFailed
          ? "Refund approved; the Kashier portion needs reconciliation."
          : `Refund approved. ${confirmedRefundEgp} EGP returned through the original payment sources.`,
      refundRequest: claimedRequest,
      walletRefundEgp: disbursement.walletRefundEgp,
      gatewayRefundEgp: disbursement.confirmedGatewayRefundEgp,
      paymentStatus: paymentFullyRefunded
        ? "refunded"
        : confirmedRefundEgp > 0
          ? "partially_refunded"
          : payment.overallStatus,
    });
  } catch (error) {
    console.error("Error approving refund request:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  } finally {
    await Payment.updateOne(
      { _id: payment._id, "refundLock.token": refundLockToken },
      { $unset: { refundLock: 1 } },
    );
  }
}
