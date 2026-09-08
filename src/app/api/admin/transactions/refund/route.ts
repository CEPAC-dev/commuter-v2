import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { Trip } from "@/models/Trip";
import { WalletTransaction } from "@/models/WalletTransaction";
import { creditWallet } from "@/lib/wallet/wallet";
import {
  refundKashierPayment,
  resolveKashierRefundOrderId,
} from "@/lib/payments/kashier";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const eligibleStatuses = ["submitted", "matched", "nomatch"];
  const existingTrip = await Trip.findOne({
    _id: tripId,
    requestId: payment.bookingId,
  }).select("adminRefund");
  const previousAdminRefund = existingTrip?.adminRefund as
    | {
        status?: string;
        refundAmountEgp?: number;
        compensationAmountEgp?: number;
      }
    | null
    | undefined;
  const trip = await Trip.findOneAndUpdate(
    {
      _id: tripId,
      requestId: payment.bookingId,
      status: { $in: eligibleStatuses },
      $or: [{ adminRefund: null }, { "adminRefund.status": "failed" }],
      "cancellation.refundStatus": { $nin: ["pending", "approved"] },
    },
    {
      $set: {
        adminRefund: {
          status: "processing",
          paymentId: payment._id,
          refundedBy: new Types.ObjectId(auth.userId),
          refundAmountEgp: 0,
          compensationPercent,
          compensationAmountEgp: 0,
          totalReturnEgp: 0,
          reason,
        },
      },
    },
    { returnDocument: "after" },
  );
  if (!trip)
    return NextResponse.json(
      {
        error:
          "Trip is not refundable. It must be submitted, matched, or nomatch, and not already refunded successfully.",
      },
      { status: 409 },
    );

  const isBaseRefundEligible = ["submitted", "matched", "nomatch"].includes(
    trip.status,
  );
  const previousRefundEgp =
    previousAdminRefund?.status === "failed"
      ? (previousAdminRefund.refundAmountEgp ?? 0)
      : 0;
  const previousCompensationEgp =
    previousAdminRefund?.status === "failed"
      ? (previousAdminRefund.compensationAmountEgp ?? 0)
      : 0;
  const amountEgp = isBaseRefundEligible
    ? Math.max(0, Number(trip.priceEgp) - previousRefundEgp)
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
    return NextResponse.json(
      {
        error: `Refund exceeds remaining refundable amount (${refundableTotal} EGP).`,
      },
      { status: 400 },
    );
  }

  // Split refund: wallet portion first, then Kashier.
  const walletCaptured =
    payment.walletStatus === "captured" ? payment.walletAmountEgp : 0;
  const walletAlreadyRefunded = payment.walletRefundTxIds?.length
    ? Math.min(walletCaptured, alreadyRefunded)
    : 0;
  const walletRemaining = Math.max(0, walletCaptured - walletAlreadyRefunded);
  const walletRefundEgp = Math.min(amountEgp, walletRemaining);
  const gatewayRefundEgp = amountEgp - walletRefundEgp;

  const timelineEvents: { event: string; detail?: string }[] = [
    {
      event: "refund_requested",
      detail: `${amountEgp} EGP (reason: ${reason ?? "n/a"})`,
    },
  ];

  // ── 1. Wallet portion ──
  let walletRefundTxId: Types.ObjectId | null = null;
  if (walletRefundEgp > 0) {
    await creditWallet(String(payment.userId), walletRefundEgp, {
      description: `Refund for booking ${payment.bookingId}${reason ? ` — ${reason}` : ""}`,
      type: "refund",
      paymentId: String(payment._id),
      bookingId: String(payment.bookingId),
      tripId: String(trip._id),
    });
    // Find the newly created ledger row for reference.
    const created = await WalletTransaction.findOne({
      userId: payment.userId,
      paymentId: payment._id,
      type: "refund",
    })
      .sort({ createdAt: -1 })
      .select("_id");
    if (created) walletRefundTxId = created._id as Types.ObjectId;
    timelineEvents.push({
      event: "wallet_refunded",
      detail: `${walletRefundEgp} EGP`,
    });
  }

  // ── 2. Kashier portion ──
  let kashierRefundId: string | null = null;
  let gatewayRefundFailed = false;
  if (gatewayRefundEgp > 0) {
    const kashierOrderId = await resolveKashierRefundOrderId(
      payment.kashierSessionId,
      payment.kashierOrderId,
    );
    if (!kashierOrderId) {
      gatewayRefundFailed = true;
      timelineEvents.push({ event: "kashier_refund_skipped_no_order" });
    } else {
      const result = await refundKashierPayment(
        kashierOrderId,
        gatewayRefundEgp,
        reason,
      );
      if (result) {
        kashierRefundId = result.refundId;
        await WalletTransaction.create({
          userId: payment.userId,
          type: "payment_refund_partial",
          amountEgp: gatewayRefundEgp,
          status: "completed",
          description: `Kashier refund for booking ${payment.bookingId}${reason ? ` — ${reason}` : ""}`,
          paymentId: payment._id,
          bookingId: payment.bookingId,
          tripId: trip._id,
          kashierOrderId,
          kashierTransactionIds: [result.refundId],
        });
        timelineEvents.push({
          event: "kashier_refunded",
          detail: `${gatewayRefundEgp} EGP ref ${result.refundId}`,
        });
      } else {
        gatewayRefundFailed = true;
        timelineEvents.push({
          event: "kashier_refund_failed",
          detail: `${gatewayRefundEgp} EGP — manual accountant action required`,
        });
      }
    }
  }

  const newRefundedTotal =
    alreadyRefunded +
    walletRefundEgp +
    (gatewayRefundFailed ? 0 : gatewayRefundEgp);
  const fullyRefunded = amountEgp > 0 && newRefundedTotal >= payment.totalEgp;

  const update: Record<string, unknown> =
    amountEgp > 0
      ? {
          refundedAt: new Date(),
          refundedAmountEgp: newRefundedTotal,
          overallStatus: fullyRefunded ? "refunded" : "partially_refunded",
        }
      : {};
  if (walletRefundEgp > 0 && fullyRefunded) update.walletStatus = "refunded";
  if (gatewayRefundEgp > 0 && !gatewayRefundFailed && fullyRefunded)
    update.gatewayStatus = "refunded";
  if (payment.kashierSessionId && gatewayRefundEgp > 0) {
    update.kashierOrderId = await resolveKashierRefundOrderId(
      payment.kashierSessionId,
      payment.kashierOrderId,
    );
  }

  if (!gatewayRefundFailed && compensationAmountEgp > 0) {
    await creditWallet(String(payment.userId), compensationAmountEgp, {
      description: `Compensation (${compensationPercent}%) for trip ${trip._id}${reason ? ` — ${reason}` : ""}`,
      type: "compensation",
      paymentId: String(payment._id),
      bookingId: String(payment.bookingId),
      tripId: String(trip._id),
    });
    update.compensatedAmountEgp =
      (payment.compensatedAmountEgp ?? 0) + compensationAmountEgp;
    timelineEvents.push({
      event: "trip_compensation_credited",
      detail: `${compensationAmountEgp} EGP (${compensationPercent}%) for trip ${trip._id}`,
    });
  }

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
        "adminRefund.status": gatewayRefundFailed ? "failed" : "completed",
        ...(gatewayRefundFailed ? {} : { status: "refunded" }),
        "adminRefund.refundedAt": new Date(),
        "adminRefund.refundAmountEgp":
          previousRefundEgp +
          walletRefundEgp +
          (gatewayRefundFailed ? 0 : gatewayRefundEgp),
        "adminRefund.compensationAmountEgp":
          previousCompensationEgp + compensationAmountEgp,
        "adminRefund.totalReturnEgp":
          previousRefundEgp +
          walletRefundEgp +
          (gatewayRefundFailed ? 0 : gatewayRefundEgp) +
          previousCompensationEgp +
          compensationAmountEgp,
        ...(gatewayRefundFailed
          ? {
              "adminRefund.failureReason":
                "Kashier refund failed; manual accountant action required",
            }
          : { paymentStatus: "refunded" }),
      },
    },
  );

  return NextResponse.json({
    ok: true,
    refundedAmountEgp:
      walletRefundEgp + (gatewayRefundFailed ? 0 : gatewayRefundEgp),
    walletRefundEgp,
    gatewayRefundEgp: gatewayRefundFailed ? 0 : gatewayRefundEgp,
    compensationAmountEgp,
    gatewayRefundFailed,
    kashierRefundId,
    overallStatus: update.overallStatus,
  });
}
