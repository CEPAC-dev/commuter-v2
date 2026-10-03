import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Types } from "mongoose";
import { reconcileKashierRefund } from "@/lib/payments/kashierRefundReconciliation";
import { queryKashierRefundTransaction } from "@/lib/payments/kashier";
import { Trip } from "@/models/Trip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const REFUND_RECONCILIATION_GRACE_MS = 5 * 60_000;
const REFUND_LOCK_STALE_MS = 5 * 60_000;

export async function POST(req: NextRequest) {
  const auth = await adminAuth(PERMISSIONS.TRANSACTIONS_REFUND);
  if (!auth.authorized) return auth.response;

  let paymentId: string;
  try {
    const body = await req.json();
    paymentId = body.paymentId;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!paymentId || !Types.ObjectId.isValid(paymentId))
    return NextResponse.json({ error: "Invalid paymentId" }, { status: 400 });

  await connectDB();
  const payment = await Payment.findById(paymentId);
  if (!payment)
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (payment.refundLock) {
    if (
      Date.now() - payment.refundLock.acquiredAt.getTime() <
      REFUND_LOCK_STALE_MS
    ) {
      return NextResponse.json(
        { error: "A refund is currently being processed" },
        { status: 409 },
      );
    }
    await Payment.updateOne(
      { _id: payment._id, "refundLock.token": payment.refundLock.token },
      { $unset: { refundLock: 1 } },
    );
  }

  const timeline = payment.timeline as { event: string; detail?: string }[];
  const successfulEvents = timeline.filter((entry) =>
    [
      "kashier_refund_webhook_success",
      "kashier_refund_webhook_succeeded",
      "kashier_refund_webhook_refunded",
      "kashier_refund_webhook_complete",
      "kashier_refund_webhook_completed",
    ].includes(entry.event),
  );
  let reconciled = 0;
  let alreadyRecorded = 0;
  for (const entry of successfulEvents) {
    const match = entry.detail?.match(/^(\d+(?:\.\d+)?) EGP ref (.+)$/);
    if (!match) continue;
    const result = await reconcileKashierRefund(
      String(payment._id),
      Number(match[1]),
      match[2],
      payment.kashierOrderId ?? null,
    );
    if (result.alreadyRecorded) alreadyRecorded += 1;
    else reconciled += 1;
  }

  const unresolvedTrips = await Trip.find({
    requestId: payment.bookingId,
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
  })
    .select("_id priceEgp adminRefund")
    .lean<
      {
        _id: Types.ObjectId;
        priceEgp: number;
        adminRefund?: {
          status?: string;
          refundAmountEgp?: number;
          gatewayRefundAmountEgp?: number;
          kashierRefundId?: string;
          refundedAt?: Date;
        };
      }[]
    >();
  let providerChecked = 0;
  let providerUnavailable = 0;
  let retryReady = 0;
  let amountMismatch = 0;
  let historicalReference = 0;

  for (const trip of unresolvedTrips) {
    const expectedAmount =
      trip.adminRefund?.gatewayRefundAmountEgp ??
      Math.max(
        0,
        trip.priceEgp - (trip.adminRefund?.refundAmountEgp ?? 0),
      );
    const referenceFromTimeline = timeline
      .filter((entry) => entry.event === "kashier_refund_duplicate_reference")
      .map((entry) => {
        const match = entry.detail?.match(
          /^(\d+(?:\.\d+)?) EGP — Kashier returned already-recorded ref ([^;]+)/,
        );
        return match
          ? { amountEgp: Number(match[1]), refundId: match[2] }
          : null;
      })
      .find(
        (entry) =>
          entry &&
          entry.amountEgp === expectedAmount,
      );
    const refundId =
      trip.adminRefund?.kashierRefundId ?? referenceFromTimeline?.refundId;
    if (!refundId || expectedAmount <= 0) continue;

    const lookup = await queryKashierRefundTransaction(
      refundId,
      String(payment._id),
    );
    if (lookup.status === "unavailable") {
      providerUnavailable += 1;
      continue;
    }
    providerChecked += 1;

    const attemptAt =
      trip.adminRefund?.refundedAt ?? payment.lastRefundAttemptAt ?? null;
    const attemptIsRecent =
      attemptAt != null &&
      Date.now() - new Date(attemptAt).getTime() <
        REFUND_RECONCILIATION_GRACE_MS;

    if (
      lookup.status === "found" &&
      lookup.transactionStatus === "approved" &&
      lookup.amountEgp != null
    ) {
      const belongsToCurrentAttempt =
        lookup.date != null &&
        attemptAt != null &&
        lookup.date.getTime() >= new Date(attemptAt).getTime();
      if (lookup.amountEgp !== expectedAmount) amountMismatch += 1;
      await reconcileKashierRefund(
        String(payment._id),
        lookup.amountEgp,
        lookup.transactionId,
        payment.kashierOrderId ?? null,
        { associateTrip: belongsToCurrentAttempt },
      );
      reconciled += 1;
      if (!belongsToCurrentAttempt) historicalReference += 1;
      continue;
    }

    if (
      !attemptIsRecent &&
      (lookup.status === "not_found" ||
        (lookup.status === "found" &&
          lookup.transactionStatus === "failed"))
    ) {
      await Trip.updateOne(
        { _id: trip._id, "adminRefund.status": { $in: ["processing", "failed"] } },
        {
          $set: {
            "adminRefund.status": "failed",
            "adminRefund.failureReason":
              "Kashier confirms no successful refund for this reference",
            "adminRefund.retryAllowed": true,
          },
        },
      );
      retryReady += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    reconciled,
    alreadyRecorded,
    checked: successfulEvents.length,
    providerChecked,
    retryReady,
    amountMismatch,
    historicalReference,
    providerUnavailable,
  });
}
