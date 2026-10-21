import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { connectDB } from "@/lib/db/mongoose";
import { DEFAULT_REGION, getCurrencyConfig } from "@/lib/config/regions";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { Payment } from "@/models/Payment";
import { WalletTransaction } from "@/models/WalletTransaction";
import { verifyAndSettleTopup } from "@/lib/payments/kashier";
import { reconcileKashierRefund } from "@/lib/payments/kashierRefundReconciliation";
import {
  completeWithdrawal,
  refundWithdrawal,
  releaseReservation,
} from "@/lib/wallet/wallet";
import { queryKashierPayoutStatus } from "@/lib/payments/kashierPayout";
import { createNotification } from "@/lib/notifications/createNotification";
import {
  notifyAdminsOfPaidTrip,
  notifyAdminsOfLateTripPayment,
} from "@/lib/notifications/adminActivity";
import {
  buildSettlementRequestFilter,
  isSettlementBlockedStatus,
} from "@/lib/pendingRequestHardening";
import { Types } from "mongoose";
import {
  isTripSettlementBlocked,
  resolvePayableBooking,
} from "@/lib/payments/resolveBooking";
import {
  failStandaloneTripPayment,
  settleStandaloneTripPayment,
} from "@/lib/payments/standaloneTripSettlement";
import { settleRequestPayment } from "@/lib/payments/requestSettlement";
import { handlePaidRequestPayment } from "@/lib/payments/requestPaymentRecovery";
import { ACTIVE_PAYMENT_STATUSES } from "@/lib/payments/settlementAttempt";

const REFUND_LOCK_STALE_MS = 5 * 60_000;

async function resolveExpectedCurrencyCode(orderId: string): Promise<string> {
  const payment = await Payment.findById(orderId)
    .select("currencyCode")
    .lean<{ currencyCode?: string } | null>();
  if (payment?.currencyCode) return payment.currencyCode;

  const request = await Request.findById(orderId)
    .select("currencyCode regionCode")
    .lean<{ currencyCode?: string; regionCode?: string } | null>();
  if (request?.currencyCode) return request.currencyCode;
  if (request?.regionCode) return getCurrencyConfig(request.regionCode).code;

  const trip = await Trip.findById(orderId)
    .select("currencyCode regionCode")
    .lean<{ currencyCode?: string; regionCode?: string } | null>();
  if (trip?.currencyCode) return trip.currencyCode;
  if (trip?.regionCode) return getCurrencyConfig(trip.regionCode).code;

  return getCurrencyConfig(DEFAULT_REGION).code;
}

function verifyLegacySignature(
  p: Record<string, unknown>,
  sig: string,
  secret: string,
): boolean {
  const data = `${p.merchantId ?? ""}${p.orderId ?? ""}${p.transactionId ?? ""}${p.amount ?? ""}${p.currency ?? ""}${p.paymentStatus ?? ""}`;
  const expected = createHmac("sha256", secret).update(data).digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(sig, "hex"),
    );
  } catch {
    return false;
  }
}

function verifyKashierEventSignature(
  data: Record<string, unknown>,
  sig: string,
  paymentApiKey: string,
): boolean {
  const keys = Array.isArray(data.signatureKeys)
    ? data.signatureKeys.filter((key): key is string => typeof key === "string")
    : [];
  if (!keys.length) return false;
  const signaturePayload = keys
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(data[key] ?? ""))}`,
    )
    .join("&");
  const expected = createHmac("sha256", paymentApiKey)
    .update(signaturePayload)
    .digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(sig, "hex"),
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const payload = body.payload as Record<string, unknown> | undefined;
  const eventData = (payload?.data ?? body.data ?? body) as Record<
    string,
    unknown
  >;
  const event = String(payload?.event ?? body.event ?? "pay").toLowerCase();
  const orderId = String(eventData.merchantOrderId ?? eventData.orderId ?? "");
  const amount = eventData.amount;
  const currency = String(eventData.currency ?? "");
  const merchantDetails = eventData.merchantDetails as
    | Record<string, unknown>
    | undefined;
  const merchantIdValue =
    body.merchantId ?? eventData.merchantId ?? merchantDetails?.merchantId;
  const merchantId = typeof merchantIdValue === "string" ? merchantIdValue : "";
  const transactionId = String(eventData.transactionId ?? "");
  const paymentStatus = String(
    eventData.paymentStatus ?? eventData.status ?? "",
  );
  const signatureValue = body.signature;
  const sig =
    (typeof signatureValue === "string" ? signatureValue : "") ||
    req.headers.get("x-kashier-signature") ||
    "";
  const webhookSecret = process.env.KASHIER_SECRET_KEY;
  const paymentApiKey = process.env.KASHIER_API_KEY;
  const expectedMerchantId = process.env.KASHIER_MERCHANT_ID;

  if (
    !orderId ||
    !amount ||
    !currency ||
    !transactionId ||
    !paymentStatus ||
    !sig
  ) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!webhookSecret || !paymentApiKey || !expectedMerchantId) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const isNestedEvent = eventData !== body;
  const validSignature = isNestedEvent
    ? verifyKashierEventSignature(eventData, sig, paymentApiKey)
    : verifyLegacySignature(body, sig, webhookSecret);
  if (!validSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  await connectDB();

  const expectedCurrencyCode = await resolveExpectedCurrencyCode(orderId || "");
  if (
    (merchantId && merchantId !== expectedMerchantId) ||
    (orderId &&
      String(currency).toUpperCase() !== expectedCurrencyCode.toUpperCase())
  ) {
    return NextResponse.json(
      { error: "Invalid payment details" },
      { status: 400 },
    );
  }

  const receivedAmount = Number(amount);
  if (!Number.isFinite(receivedAmount)) {
    return NextResponse.json(
      { error: "Invalid payment details" },
      { status: 400 },
    );
  }

  const st = paymentStatus.toLowerCase();
  const paid = [
    "success",
    "captured",
    "paid",
    "complete",
    "completed",
  ].includes(st);

  // Refund callbacks are the final authority when Kashier's synchronous
  // response was ambiguous or arrived out of order.
  if (event === "refund") {
    if (!Types.ObjectId.isValid(orderId))
      return NextResponse.json({ error: "Unknown payment" }, { status: 404 });

    const payment = await Payment.findById(orderId);
    if (!payment)
      return NextResponse.json({ error: "Unknown payment" }, { status: 404 });
    if (payment.refundLock) {
      if (
        Date.now() - payment.refundLock.acquiredAt.getTime() <
        REFUND_LOCK_STALE_MS
      ) {
        return NextResponse.json(
          { error: "Refund is still being processed" },
          { status: 503, headers: { "Retry-After": "5" } },
        );
      }
      await Payment.updateOne(
        { _id: payment._id, "refundLock.token": payment.refundLock.token },
        { $unset: { refundLock: 1 } },
      );
    }

    const successfulRefund = [
      "success",
      "succeeded",
      "refunded",
      "complete",
      "completed",
    ].includes(st);
    const failedRefund = ["failed", "declined", "error", "rejected"].includes(
      st,
    );
    const eventName = `kashier_refund_webhook_${st}`;
    const detail = `${receivedAmount} EGP ref ${transactionId}`;

    if (successfulRefund) {
      await reconcileKashierRefund(
        String(payment._id),
        receivedAmount,
        transactionId,
        payment.kashierOrderId ?? null,
      );
    } else if (failedRefund) {
      const alreadyRefunded = await WalletTransaction.exists({
        paymentId: payment._id,
        type: "payment_refund_partial",
        $or: [
          { kashierRefundId: transactionId },
          { kashierTransactionIds: transactionId },
        ],
      });
      if (!alreadyRefunded) {
        const candidates = await Trip.find({
          requestId: payment.bookingId,
          "adminRefund.paymentId": payment._id,
          "adminRefund.status": { $in: ["processing", "failed"] },
          "adminRefund.gatewayRefundAmountEgp": receivedAmount,
        })
          .select("_id")
          .lean<{ _id: Types.ObjectId }[]>();
        if (candidates.length === 1) {
          await Trip.updateOne(
            {
              _id: candidates[0]._id,
              "adminRefund.status": { $in: ["processing", "failed"] },
            },
            {
              $set: {
                "adminRefund.status": "failed",
                "adminRefund.failureReason": "Kashier confirmed refund failure",
                "adminRefund.retryAllowed": true,
              },
            },
          );
        }
      }
    }

    const duplicateEvent = await Payment.exists({
      _id: payment._id,
      timeline: { $elemMatch: { event: eventName, detail } },
    });
    if (!duplicateEvent) {
      await Payment.updateOne(
        { _id: payment._id },
        {
          $push: {
            timeline: {
              event: eventName,
              detail,
              actor: "kashier",
            },
          },
        },
      );
    }
    return NextResponse.json({ received: true });
  }

  // ── Route by record type ──
  if (Types.ObjectId.isValid(orderId)) {
    // 1) Wallet top-up
    const topup = await WalletTransaction.findOne({
      _id: orderId,
      type: "topup",
    });
    if (topup) {
      if (receivedAmount !== topup.amountEgp) {
        return NextResponse.json(
          { error: "Invalid payment details" },
          { status: 400 },
        );
      }
      const claimed = await WalletTransaction.findOneAndUpdate(
        { _id: topup._id, kashierTransactionIds: { $ne: transactionId } },
        { $addToSet: { kashierTransactionIds: transactionId } },
      );
      if (!claimed) {
        return NextResponse.json(
          { error: "Transaction already processed" },
          { status: 400 },
        );
      }
      await verifyAndSettleTopup(orderId);
      return NextResponse.json({ received: true });
    }

    // 2) Driver withdrawal
    const withdrawal = await WalletTransaction.findOne({
      _id: orderId,
      type: "withdrawal",
    });
    if (withdrawal) {
      if (receivedAmount !== withdrawal.amountEgp) {
        return NextResponse.json(
          { error: "Invalid payment details" },
          { status: 400 },
        );
      }
      const claimed = await WalletTransaction.findOneAndUpdate(
        { _id: withdrawal._id, kashierTransactionIds: { $ne: transactionId } },
        { $addToSet: { kashierTransactionIds: transactionId } },
      );
      if (!claimed) {
        return NextResponse.json(
          { error: "Transaction already processed" },
          { status: 400 },
        );
      }
      const payoutId = withdrawal.kashierPayoutId;
      if (payoutId) {
        const outcome = await queryKashierPayoutStatus(payoutId);
        if (outcome === "completed")
          await completeWithdrawal(orderId, payoutId);
        else if (outcome === "failed") await refundWithdrawal(orderId);
      }
      return NextResponse.json({ received: true });
    }

    // 3) Mixed-payment Payment doc
    const payment = await Payment.findById(orderId);
    if (payment) {
      if (receivedAmount !== payment.gatewayAmountEgp) {
        return NextResponse.json(
          { error: "Invalid payment details" },
          { status: 400 },
        );
      }
      const mixedBooking = await resolvePayableBooking(
        String(payment.bookingId),
        String(payment.userId),
      );
      if (paid && mixedBooking?.kind === "request") {
        const recovery = await handlePaidRequestPayment({
          paymentId: String(payment._id),
          transactionId,
        });
        if (recovery === "capture_failed") {
          return NextResponse.json(
            { error: "Payment settlement failed; retry webhook" },
            { status: 500 },
          );
        }
        return NextResponse.json({ received: true });
      }
      const claimed = await Payment.findOneAndUpdate(
        { _id: payment._id, kashierTransactionIds: { $ne: transactionId } },
        { $addToSet: { kashierTransactionIds: transactionId } },
      );
      if (!claimed) {
        const duplicatePayment = await Payment.exists({
          _id: payment._id,
          kashierTransactionIds: transactionId,
        });
        if (duplicatePayment && paid) {
          const duplicateBooking = await resolvePayableBooking(
            String(payment.bookingId),
            String(payment.userId),
          );
          if (
            duplicateBooking?.kind === "trip" &&
            isTripSettlementBlocked(duplicateBooking.status)
          ) {
            await notifyAdminsOfLateTripPayment(
              String(payment._id),
              String(duplicateBooking.doc._id),
            );
          }
        }
        return NextResponse.json(
          { error: "Transaction already processed" },
          { status: 400 },
        );
      }
      if (mixedBooking?.kind === "trip") {
        await Trip.updateOne(
          { _id: mixedBooking.doc._id, requestId: null },
          { $addToSet: { kashierTransactionIds: transactionId } },
        );
      }
      const settlementBlocked =
        mixedBooking?.kind === "trip"
          ? isTripSettlementBlocked(mixedBooking.status)
          : mixedBooking?.kind === "request" &&
            isSettlementBlockedStatus(mixedBooking.status);
      if (settlementBlocked) {
        if (mixedBooking?.kind === "trip") {
          const blockedTripDetails = {
            tripId: String(mixedBooking.doc._id),
            paymentId: String(payment._id),
            kashierTransactionId: transactionId,
          };
          console.warn(
            "[Payment] Webhook received for blocked Trip",
            blockedTripDetails,
          );
          await Payment.updateOne(
            { _id: payment._id },
            {
              $push: {
                timeline: {
                  event: "blocked_trip_payment_webhook",
                  detail: `Trip ${blockedTripDetails.tripId}; Kashier transaction ${transactionId}`,
                  actor: "kashier",
                  meta: blockedTripDetails,
                },
              },
            },
          );
          if (paid) {
            await notifyAdminsOfLateTripPayment(
              String(payment._id),
              blockedTripDetails.tripId,
            );
          }
        }
        console.warn(
          `[Payment] Refusing webhook settlement for blocked booking ${String(payment.bookingId)} (${mixedBooking?.status ?? "not found"})`,
        );
        return NextResponse.json(
          { error: "Transaction already processed" },
          { status: 400 },
        );
      }
      await settleMixedPayment(String(payment._id), paid, transactionId);
      return NextResponse.json({ received: true });
    }

    // 4) Legacy: orderId == Request._id (pre-Payment bookings)
    const legacyBooking = await Request.findById(orderId)
      .select("amountEgp userId status")
      .lean<{
        _id: Types.ObjectId;
        amountEgp: number;
        userId: Types.ObjectId;
        status?: string;
      }>();
    if (legacyBooking) {
      if (isSettlementBlockedStatus(legacyBooking.status)) {
        console.warn(
          `[Payment] Refusing legacy webhook settlement for blocked booking ${String(orderId)} (${legacyBooking.status})`,
        );
        return NextResponse.json(
          { error: "Transaction already processed" },
          { status: 400 },
        );
      }
      if (receivedAmount !== legacyBooking.amountEgp) {
        return NextResponse.json(
          { error: "Invalid payment details" },
          { status: 400 },
        );
      }
      if (paid) {
        const settlement = await settleRequestPayment(orderId, {
          transactionId,
        });
        if (settlement === "capture_failed") {
          return NextResponse.json(
            { error: "Payment settlement failed; retry webhook" },
            { status: 500 },
          );
        }
        if (settlement === "not_settled") {
          return NextResponse.json(
            { error: "Transaction already processed" },
            { status: 400 },
          );
        }
        return NextResponse.json({ received: true });
      }

      const settled = await Request.findOneAndUpdate(
        {
          ...buildSettlementRequestFilter(orderId),
          kashierTransactionIds: { $ne: transactionId },
        },
        {
          $set: { paymentStatus: "failed" },
          $addToSet: { kashierTransactionIds: transactionId },
        },
      );
      if (!settled) {
        return NextResponse.json(
          { error: "Transaction already processed" },
          { status: 400 },
        );
      }
      await createNotification({
        userId: String(settled.userId),
        type: "payment_failed",
        title: "Payment issue",
        body: "We couldn’t confirm your payment. You can try again from your requests page.",
        data: { bookingId: String(settled._id) },
      });
      return NextResponse.json({ received: true });
    }
  }

  return NextResponse.json({ error: "Unknown order" }, { status: 400 });
}

/**
 * Finalize a mixed-payment Payment against a webhook outcome. Idempotent via
 * overallStatus filter — only transitions from `wallet_reserved` or
 * `kashier_pending`.
 */
async function settleMixedPayment(
  paymentId: string,
  paid: boolean,
  transactionId: string,
): Promise<Awaited<ReturnType<typeof settleRequestPayment>> | void> {
  const payment = await Payment.findById(paymentId);
  if (!payment) return;

  const resolved = await resolvePayableBooking(
    String(payment.bookingId),
    String(payment.userId),
  );
  if (resolved?.kind === "trip") {
    if (paid) {
      const outcome = await settleStandaloneTripPayment(
        String(resolved.doc._id),
        String(payment._id),
        transactionId,
      );
      if (outcome === "settled") {
        await notifyAdminsOfPaidTrip(String(resolved.doc._id));
        await createNotification({
          userId: String(payment.userId),
          type: "payment_paid",
          title: "Payment completed",
          body: "Your trip payment was successful.",
          data: {
            tripId: String(resolved.doc._id),
            linkUrl: `/my-trips/${resolved.doc._id}`,
            paymentId: String(payment._id),
          },
        });
      }
      return;
    }

    const outcome = await failStandaloneTripPayment(
      String(resolved.doc._id),
      String(payment._id),
      transactionId,
    );
    if (outcome === "failed") {
      await createNotification({
        userId: String(payment.userId),
        type: "payment_failed",
        title: "Payment issue",
        body: "We couldn’t confirm your payment. You can try again from your trips page.",
        data: {
          tripId: String(resolved.doc._id),
          linkUrl: `/my-trips/${resolved.doc._id}`,
          paymentId: String(payment._id),
        },
      });
    }
    return;
  }

  if (!ACTIVE_PAYMENT_STATUSES.includes(payment.overallStatus)) return;
  if (paid) {
    const settlement = await settleRequestPayment(String(payment.bookingId), {
      paymentId: String(payment._id),
      transactionId,
    });
    if (settlement !== "not_settled") return settlement;

    {
      // Booking already settled elsewhere — refund whatever this Payment
      // took instead of capturing/keeping it.
      if (
        payment.walletReservationTxId &&
        payment.walletStatus === "reserved"
      ) {
        await releaseReservation(String(payment.walletReservationTxId), {
          description: `Released — booking already settled (duplicate payment ${payment._id})`,
          paymentId: String(payment._id),
          bookingId: String(payment.bookingId),
        });
      }
      let gatewayRefunded = false;
      if (payment.gatewayAmountEgp > 0 && payment.kashierOrderId) {
        const { refundKashierPayment } = await import("@/lib/payments/kashier");
        const refund = await refundKashierPayment(
          payment.kashierOrderId,
          payment.gatewayAmountEgp,
          "Duplicate payment — booking already settled",
        );
        gatewayRefunded = refund !== null;
      }
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            overallStatus: "cancelled",
            walletStatus: payment.walletAmountEgp > 0 ? "released" : "none",
            gatewayStatus:
              payment.gatewayAmountEgp > 0
                ? gatewayRefunded
                  ? "refunded"
                  : "success"
                : "none",
          },
          $push: {
            timeline: {
              event: "duplicate_settlement_prevented",
              detail: gatewayRefunded
                ? "wallet released, gateway refunded"
                : payment.gatewayAmountEgp > 0
                  ? "wallet released, gateway refund FAILED — manual action required"
                  : "wallet released",
            },
          },
        },
      );
      await createNotification({
        userId: String(payment.userId),
        type: "payment_failed",
        title: "Payment issue",
        body: "This booking was already paid by another request. Any charge has been reversed.",
        data: {
          bookingId: String(payment.bookingId),
          paymentId: String(payment._id),
        },
      });
      return "not_settled";
    }
  }

  // Failed / cancelled
  if (payment.walletReservationTxId && payment.walletStatus === "reserved") {
    await releaseReservation(String(payment.walletReservationTxId), {
      description: `Released — Kashier failed for booking ${payment.bookingId}`,
      paymentId: String(payment._id),
      bookingId: String(payment.bookingId),
    });
  }
  await Payment.updateOne(
    { _id: payment._id },
    {
      $set: {
        gatewayStatus: "failed",
        walletStatus:
          payment.walletAmountEgp > 0 ? "released" : payment.walletStatus,
        overallStatus: "failed",
      },
      $push: { timeline: { event: "kashier_failed", detail: transactionId } },
    },
  );
  await Request.updateOne(
    { _id: payment.bookingId, paymentStatus: "pending" },
    { $set: { paymentStatus: "failed" } },
  );
  await createNotification({
    userId: String(payment.userId),
    type: "payment_failed",
    title: "Payment issue",
    body: "We couldn’t confirm your payment. You can try again from your requests page.",
    data: {
      bookingId: String(payment.bookingId),
      paymentId: String(payment._id),
    },
  });
}
