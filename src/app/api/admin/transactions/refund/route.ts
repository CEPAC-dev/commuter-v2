import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { Trip } from "@/models/Trip";
import { WalletTransaction } from "@/models/WalletTransaction";
import { creditWallet as creditWalletForCompensation } from "@/lib/wallet/wallet";
import { createNotification } from "@/lib/notifications/createNotification";
import { resolveKashierRefundOrderId } from "@/lib/payments/kashier";
import { disburseTripRefund } from "@/lib/payments/refundDisbursement";
import { reconcileRequestSummary } from "@/lib/payments/requestReconciliation";
import { resolvePayableBooking } from "@/lib/payments/resolveBooking";
import { fullyRefundedTripUpdate } from "@/lib/payments/tripSettlement";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REFUND_COOLDOWN_MS = 60_000;
const REFUND_LOCK_STALE_MS = 5 * 60_000;

/**
 * Issue a refund against a paid Payment. Wallet portion is refunded first
 * (creating a NEW `refund` ledger row), then Kashier is called for the
 * remainder. Original successful ledger rows are NEVER mutated.
 */
export async function POST(req: NextRequest) {
  const auth = await adminAuth(PERMISSIONS.TRANSACTIONS_REFUND);
  if (!auth.authorized) return auth.response;

  let paymentId: string;
  let tripId: string;
  let compensationPercent: number;
  let reason: string | undefined;
  try {
    const body = await req.json();
    paymentId = body.paymentId;
    tripId = body.tripId;
    compensationPercent = Number(body.compensationPercent ?? 0);
    reason = typeof body.reason === "string" ? body.reason : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!paymentId || !Types.ObjectId.isValid(paymentId))
    return NextResponse.json({ error: "Invalid paymentId" }, { status: 400 });
  if (!tripId || !Types.ObjectId.isValid(tripId))
    return NextResponse.json({ error: "Invalid tripId" }, { status: 400 });
  if (![0, 15, 25, 35, 50, 75].includes(compensationPercent))
    return NextResponse.json(
      { error: "Invalid compensation percentage" },
      { status: 400 },
    );

  await connectDB();

  const payment = await Payment.findById(paymentId);
  if (!payment)
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (
    payment.overallStatus !== "paid" &&
    payment.overallStatus !== "partially_refunded"
  )
    return NextResponse.json(
      { error: `Cannot refund a payment with status ${payment.overallStatus}` },
      { status: 400 },
    );

  // This is an admin lookup: omit userId intentionally. Request-backed
  // Payments continue to resolve through their Request id.
  const payableBooking = await resolvePayableBooking(String(payment.bookingId));
  if (!payableBooking)
    return NextResponse.json(
      { error: "Payment booking not found" },
      { status: 404 },
    );
  const tripBookingScope =
    payableBooking.kind === "trip"
      ? { _id: payment.bookingId, requestId: null }
      : { requestId: payment.bookingId };
  if (
    payableBooking.kind === "trip" &&
    String(payableBooking.doc._id) !== tripId
  ) {
    return NextResponse.json(
      { error: "Trip does not belong to this payment" },
      { status: 409 },
    );
  }

  const unresolvedGatewayRefund = await Trip.exists({
    ...tripBookingScope,
    "adminRefund.paymentId": payment._id,
    $or: [
      {
        "adminRefund.status": "processing",
        "adminRefund.gatewayRefundAmountEgp": { $gt: 0 },
      },
      {
        "adminRefund.failureReason": {
          $regex: "existing refund reference|outcome is unconfirmed",
          $options: "i",
        },
      },
    ],
  });
  if (unresolvedGatewayRefund) {
    return NextResponse.json(
      {
        error:
          "A Kashier refund is awaiting reconciliation. Reconcile the recorded Kashier result before issuing another refund for this payment.",
      },
      { status: 409 },
    );
  }

  const completedGatewayRefunds = await WalletTransaction.find({
    paymentId: payment._id,
    type: "payment_refund_partial",
    status: "completed",
  })
    .select("kashierTransactionIds amountEgp")
    .lean<{ kashierTransactionIds?: string[]; amountEgp: number }[]>();
  const seenRefundIds = new Set<string>();
  const hasUnreconciledRefundLedger = completedGatewayRefunds.some((entry) => {
    const ids = entry.kashierTransactionIds ?? [];
    if (ids.length !== 1 || seenRefundIds.has(ids[0])) return true;
    seenRefundIds.add(ids[0]);
    return false;
  });
  if (hasUnreconciledRefundLedger) {
    return NextResponse.json(
      {
        error:
          "Existing Kashier refund records contain missing or repeated transaction IDs. Reconcile this payment against Kashier before issuing another refund.",
      },
      { status: 409 },
    );
  }

  const eligibleStatuses = ["submitted", "matched", "nomatch"];
  const tripRefundFilter = {
    _id: tripId,
    ...(payableBooking.kind === "trip"
      ? { requestId: null }
      : { requestId: payment.bookingId }),
    status: { $in: eligibleStatuses },
    $or: [
      { adminRefund: null },
      { "adminRefund.status": "failed", "adminRefund.retryAllowed": true },
    ],
    "cancellation.refundStatus": { $nin: ["pending", "approved"] },
  };
  const existingTrip =
    await Trip.findOne(tripRefundFilter).select("adminRefund");
  if (!existingTrip)
    return NextResponse.json(
      {
        error:
          "Trip is not refundable. It must be submitted, matched, or nomatch, and not already refunded successfully.",
      },
      { status: 409 },
    );

  const now = new Date();
  const lastRefundAttemptAt = payment.lastRefundAttemptAt?.getTime();
  if (
    lastRefundAttemptAt &&
    now.getTime() - lastRefundAttemptAt < REFUND_COOLDOWN_MS
  ) {
    const retryAfterSeconds = Math.ceil(
      (REFUND_COOLDOWN_MS - (now.getTime() - lastRefundAttemptAt)) / 1000,
    );
    return NextResponse.json(
      {
        error: `Please wait ${retryAfterSeconds} seconds before refunding another trip on this payment.`,
        retryAfterSeconds,
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const refundLockToken = new Types.ObjectId().toString();
  const cooldownCutoff = new Date(now.getTime() - REFUND_COOLDOWN_MS);
  const staleLockCutoff = new Date(now.getTime() - REFUND_LOCK_STALE_MS);
  const acquiredLock = await Payment.findOneAndUpdate(
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
  if (!acquiredLock)
    return NextResponse.json(
      {
        error:
          "Another refund was just started for this payment. Please wait before retrying.",
      },
      { status: 409 },
    );

  const previousAdminRefund = existingTrip?.adminRefund as
    | {
        status?: string;
        refundAmountEgp?: number;
        compensationAmountEgp?: number;
        retryAllowed?: boolean;
      }
    | null
    | undefined;
  const retryRefundBaseEgp =
    previousAdminRefund?.status === "failed"
      ? (previousAdminRefund.refundAmountEgp ?? 0)
      : 0;
  const previousCompensationEgp =
    previousAdminRefund?.status === "failed"
      ? (previousAdminRefund.compensationAmountEgp ?? 0)
      : 0;
  const refundOperationId = `${payment._id}:${tripId}:${retryRefundBaseEgp}`;
  const trip = await Trip.findOneAndUpdate(
    tripRefundFilter,
    {
      $set: {
        adminRefund: {
          status: "processing",
          paymentId: payment._id,
          refundOperationId,
          refundedBy: new Types.ObjectId(auth.userId),
          refundAmountEgp: 0,
          compensationPercent,
          compensationAmountEgp: 0,
          totalReturnEgp: 0,
          reason,
          retryAllowed: false,
        },
      },
    },
    { returnDocument: "after" },
  );
  if (!trip) {
    await Payment.updateOne(
      { _id: payment._id, "refundLock.token": refundLockToken },
      { $unset: { refundLock: 1 } },
    );
    return NextResponse.json(
      {
        error:
          "Trip is not refundable. It must be submitted, matched, or nomatch, and not already refunded successfully.",
      },
      { status: 409 },
    );
  }

  const isBaseRefundEligible = ["submitted", "matched", "nomatch"].includes(
    trip.status,
  );
  const amountEgp = isBaseRefundEligible
    ? Math.max(0, Number(trip.priceEgp) - retryRefundBaseEgp)
    : 0;
  const targetCompensationAmountEgp = Math.round(
    (Number(trip.priceEgp) * compensationPercent) / 100,
  );
  const compensationAmountEgp = Math.max(
    0,
    targetCompensationAmountEgp - previousCompensationEgp,
  );

  const alreadyRefunded = payment.refundedAmountEgp ?? 0;
  const refundableTotal = payment.totalEgp - alreadyRefunded;
  if (amountEgp > refundableTotal) {
    await Trip.updateOne(
      { _id: trip._id, "adminRefund.status": "processing" },
      {
        $set: {
          "adminRefund.status": "failed",
          "adminRefund.failureReason":
            "Payment has insufficient refundable balance",
        },
      },
    );
    await Payment.updateOne(
      { _id: payment._id, "refundLock.token": refundLockToken },
      { $unset: { refundLock: 1 } },
    );
    return NextResponse.json(
      {
        error: `Refund exceeds remaining refundable amount (${refundableTotal} EGP).`,
      },
      { status: 400 },
    );
  }

  const disbursement = await disburseTripRefund({
    operationId: refundOperationId,
    payment,
    tripId: String(trip._id),
    amountEgp,
    reason,
  });
  const {
    walletCapturedEgp: walletCaptured,
    walletRefundEgp,
    gatewayRefundEgp,
    confirmedGatewayRefundEgp,
    walletRefundTxId,
    kashierRefundId,
    attemptedKashierRefundId,
    gatewayRefundFailed,
    gatewayRefundPending,
    gatewayRefundDuplicate,
    gatewayRefundRetrySafe,
    timelineEvents,
  } = disbursement;
  await Trip.updateOne(
    { _id: trip._id, "adminRefund.status": "processing" },
    {
      $set: {
        "adminRefund.refundOperationId": refundOperationId,
        "adminRefund.gatewayRefundAmountEgp": gatewayRefundEgp,
      },
    },
  );

  const confirmedRefundEgp = walletRefundEgp + confirmedGatewayRefundEgp;
  const confirmedRefundLedger = await WalletTransaction.aggregate<{
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
    confirmedRefundLedger.find((entry) => entry._id === "refund")?.amountEgp ??
    0;
  const gatewayRefundedTotal =
    confirmedRefundLedger.find(
      (entry) => entry._id === "payment_refund_partial",
    )?.amountEgp ?? 0;
  const newRefundedTotal = Math.min(
    payment.totalEgp,
    walletRefundedTotal + gatewayRefundedTotal || alreadyRefunded,
  );
  const fullyRefunded = amountEgp > 0 && newRefundedTotal >= payment.totalEgp;
  const fullTripUpdate =
    payableBooking.kind === "trip" && amountEgp > 0
      ? fullyRefundedTripUpdate(newRefundedTotal, Number(trip.priceEgp))
      : null;

  const update: Record<string, unknown> =
    confirmedRefundEgp > 0
      ? {
          refundedAt: new Date(),
          refundedAmountEgp: newRefundedTotal,
          overallStatus: fullyRefunded ? "refunded" : "partially_refunded",
        }
      : {};
  if (walletCaptured > 0 && walletRefundedTotal >= walletCaptured)
    update.walletStatus = "refunded";
  if (
    payment.gatewayAmountEgp > 0 &&
    gatewayRefundedTotal >= payment.gatewayAmountEgp
  )
    update.gatewayStatus = "refunded";
  if (payment.kashierSessionId && gatewayRefundEgp > 0) {
    update.kashierOrderId = await resolveKashierRefundOrderId(
      payment.kashierSessionId,
      payment.kashierOrderId,
    );
  }

  if (
    !gatewayRefundFailed &&
    !gatewayRefundPending &&
    compensationAmountEgp > 0
  ) {
    await creditWalletForCompensation(
      String(payment.userId),
      compensationAmountEgp,
      {
        description: `Compensation (${compensationPercent}%) for trip ${trip._id}${reason ? ` — ${reason}` : ""}`,
        type: "compensation",
        paymentId: String(payment._id),
        bookingId: String(payment.bookingId),
        tripId: String(trip._id),
      },
    );
    update.compensatedAmountEgp =
      (payment.compensatedAmountEgp ?? 0) + compensationAmountEgp;
    timelineEvents.push({
      event: "trip_compensation_credited",
      detail: `${compensationAmountEgp} EGP (${compensationPercent}%) for trip ${trip._id}`,
    });
  }
  const creditedCompensationEgp =
    !gatewayRefundFailed && !gatewayRefundPending ? compensationAmountEgp : 0;

  await Payment.updateOne(
    { _id: payment._id },
    {
      $set: update,
      ...(walletRefundTxId
        ? { $addToSet: { walletRefundTxIds: walletRefundTxId } }
        : {}),
      ...(kashierRefundId
        ? { $addToSet: { kashierRefundIds: kashierRefundId } }
        : {}),
      $push: { timeline: { $each: timelineEvents } },
    },
  );
  await Trip.updateOne(
    { _id: trip._id, "adminRefund.status": "processing" },
    {
      $set: {
        "adminRefund.status": gatewayRefundPending
          ? "processing"
          : gatewayRefundFailed
            ? "failed"
            : "completed",
        ...(!gatewayRefundFailed &&
        !gatewayRefundPending &&
        (payableBooking.kind === "request" || fullTripUpdate)
          ? { status: "refunded" }
          : {}),
        ...(!gatewayRefundPending
          ? { "adminRefund.refundedAt": new Date() }
          : {}),
        "adminRefund.refundAmountEgp": retryRefundBaseEgp + confirmedRefundEgp,
        "adminRefund.compensationAmountEgp":
          previousCompensationEgp + creditedCompensationEgp,
        "adminRefund.totalReturnEgp":
          retryRefundBaseEgp +
          confirmedRefundEgp +
          previousCompensationEgp +
          creditedCompensationEgp,
        ...(attemptedKashierRefundId
          ? { "adminRefund.kashierRefundId": attemptedKashierRefundId }
          : {}),
        ...(gatewayRefundFailed
          ? {
              "adminRefund.failureReason":
                "Kashier refund failed; manual accountant action required",
            }
          : gatewayRefundPending
            ? {
                "adminRefund.failureReason": gatewayRefundDuplicate
                  ? "Kashier returned an existing refund reference; reconcile the recorded result before retrying"
                  : "Kashier refund outcome is unconfirmed; verify before retrying",
              }
            : payableBooking.kind === "request"
              ? { paymentStatus: "refunded" }
              : fullTripUpdate
                ? fullTripUpdate
                : {}),
        "adminRefund.retryAllowed": gatewayRefundRetrySafe,
      },
    },
  );

  if (payableBooking.kind === "request") {
    await reconcileRequestSummary(String(payment.bookingId));
  }

  const refundTotalEgp = retryRefundBaseEgp + confirmedRefundEgp;
  const compensationTotalEgp =
    previousCompensationEgp + creditedCompensationEgp;
  const totalReturnEgp = refundTotalEgp + compensationTotalEgp;
  const tripLabel = trip.tripNumber
    ? `Trip #${trip.tripNumber}`
    : `Trip ${String(trip._id).slice(-6)}`;
  const pickupAddress = trip.pickup?.address ?? "Pickup location";
  const dropoffAddress = trip.dropoff?.address ?? "Drop-off location";
  const outcomeTitle = gatewayRefundPending
    ? "Trip refund confirmation pending"
    : gatewayRefundFailed
      ? "Trip refund needs review"
      : "Trip refund completed";
  const outcomeBody = gatewayRefundPending
    ? `${tripLabel} on ${trip.date}, ${pickupAddress} to ${dropoffAddress}. Trip status remains ${trip.status}. Confirmed refund: ${refundTotalEgp} EGP (wallet ${retryRefundBaseEgp + walletRefundEgp}, Kashier ${confirmedGatewayRefundEgp}); compensation: ${compensationTotalEgp} EGP. ${gatewayRefundDuplicate ? "Kashier returned a refund reference already recorded; verify with Kashier before retrying." : "Kashier is still confirming the remaining amount."} ${reason ? `Reason: ${reason}` : ""}`
    : gatewayRefundFailed
      ? `${tripLabel} on ${trip.date}, ${pickupAddress} to ${dropoffAddress}. Trip status remains ${trip.status}. Confirmed refund: ${refundTotalEgp} EGP (wallet ${retryRefundBaseEgp + walletRefundEgp}, Kashier ${confirmedGatewayRefundEgp}); compensation: ${compensationTotalEgp} EGP. The Kashier portion needs review. ${reason ? `Reason: ${reason}` : ""}`
      : `${tripLabel} on ${trip.date}, ${pickupAddress} to ${dropoffAddress} is now refunded. Refund: ${refundTotalEgp} EGP (wallet ${retryRefundBaseEgp + walletRefundEgp}, Kashier ${confirmedGatewayRefundEgp}); compensation: ${compensationTotalEgp} EGP; total returned: ${totalReturnEgp} EGP. ${reason ? `Reason: ${reason}` : ""}`;
  const outcomeTitleAr = gatewayRefundPending
    ? "تأكيد استرداد الرحلة قيد الانتظار"
    : gatewayRefundFailed
      ? "استرداد الرحلة يحتاج إلى مراجعة"
      : "تم استرداد قيمة الرحلة";
  const outcomeBodyAr = gatewayRefundPending
    ? `${tripLabel} بتاريخ ${trip.date} من ${pickupAddress} إلى ${dropoffAddress}. المبلغ المؤكد استرداده: ${refundTotalEgp} ج.م (المحفظة ${retryRefundBaseEgp + walletRefundEgp}، كاشير ${confirmedGatewayRefundEgp})؛ التعويض: ${compensationTotalEgp} ج.م. ${gatewayRefundDuplicate ? "أعادت كاشير رقم استرداد مسجلاً من قبل؛ يرجى التحقق من كاشير قبل إعادة المحاولة." : "ما زلنا نتحقق من الجزء المتبقي عبر كاشير."}`
    : gatewayRefundFailed
      ? `${tripLabel} بتاريخ ${trip.date} من ${pickupAddress} إلى ${dropoffAddress}. المبلغ المؤكد استرداده: ${refundTotalEgp} ج.م (المحفظة ${retryRefundBaseEgp + walletRefundEgp}، كاشير ${confirmedGatewayRefundEgp})؛ التعويض: ${compensationTotalEgp} ج.م. الجزء الخاص بكاشير يحتاج إلى مراجعة.`
      : `تم استرداد قيمة ${tripLabel} بتاريخ ${trip.date} من ${pickupAddress} إلى ${dropoffAddress}. المبلغ المسترد: ${refundTotalEgp} ج.م (المحفظة ${retryRefundBaseEgp + walletRefundEgp}، كاشير ${confirmedGatewayRefundEgp})؛ التعويض: ${compensationTotalEgp} ج.م؛ إجمالي المبلغ المعاد: ${totalReturnEgp} ج.م.`;
  try {
    await createNotification({
      userId: String(trip.userId),
      type: "trip_refund_update",
      title: outcomeTitle,
      body: outcomeBody,
      titleAr: outcomeTitleAr,
      bodyAr: outcomeBodyAr,
      data: {
        tripId: String(trip._id),
        bookingId: String(payment.bookingId),
        linkUrl: "/my-trips",
        tripStatus:
          gatewayRefundFailed || gatewayRefundPending
            ? trip.status
            : "refunded",
        refundStatus: gatewayRefundPending
          ? "pending"
          : gatewayRefundFailed
            ? "needs_review"
            : "completed",
        duplicateGatewayRefundReference: gatewayRefundDuplicate,
        refundedAmountEgp: refundTotalEgp,
        compensationAmountEgp: compensationTotalEgp,
        totalReturnEgp,
        walletRefundEgp: retryRefundBaseEgp + walletRefundEgp,
        gatewayRefundEgp: confirmedGatewayRefundEgp,
        reason: reason ?? "",
      },
    });
  } catch (error) {
    console.error("Failed to notify passenger about trip refund", {
      tripId: String(trip._id),
      error,
    });
  }

  await Payment.updateOne(
    { _id: payment._id, "refundLock.token": refundLockToken },
    { $unset: { refundLock: 1 } },
  );

  return NextResponse.json({
    ok: true,
    refundedAmountEgp: confirmedRefundEgp,
    walletRefundEgp,
    gatewayRefundEgp: confirmedGatewayRefundEgp,
    compensationAmountEgp: creditedCompensationEgp,
    gatewayRefundFailed,
    gatewayRefundPending,
    gatewayRefundDuplicate,
    kashierRefundId,
    overallStatus: update.overallStatus,
  });
}
