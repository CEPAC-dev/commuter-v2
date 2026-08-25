import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { Payment } from "@/models/Payment";
import { WalletTransaction } from "@/models/WalletTransaction";
import { verifyAndSettleTopup } from "@/lib/payments/kashier";
import {
  completeWithdrawal,
  refundWithdrawal,
  captureReservation,
  releaseReservation,
} from "@/lib/wallet/wallet";
import { queryKashierPayoutStatus } from "@/lib/payments/kashierPayout";
import { createNotification } from "@/lib/notifications/createNotification";
import { Types } from "mongoose";

function verifySignature(
  p: Record<string, string>,
  sig: string,
  secret: string,
): boolean {
  const data = `${p.merchantId}${p.orderId}${p.transactionId}${p.amount}${p.currency}${p.paymentStatus}`;
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

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const orderId = body.merchantOrderId ?? body.orderId;
  const amount = body.amount;
  const currency = body.currency;
  const merchantId = body.merchantId;
  const transactionId = body.transactionId;
  const paymentStatus = body.paymentStatus ?? body.status;
  const sig = body.signature || req.headers.get("x-kashier-signature") || "";
  const webhookSecret = process.env.KASHIER_SECRET_KEY;
  const expectedMerchantId = process.env.KASHIER_MERCHANT_ID;

  if (
    !orderId ||
    !amount ||
    !currency ||
    !merchantId ||
    !transactionId ||
    !paymentStatus ||
    !sig
  ) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!webhookSecret || !expectedMerchantId) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!verifySignature(body, sig, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (merchantId !== expectedMerchantId || currency.toUpperCase() !== "EGP") {
    return NextResponse.json(
      { error: "Invalid payment details" },
      { status: 400 },
    );
  }

  await connectDB();

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
      const claimed = await Payment.findOneAndUpdate(
        { _id: payment._id, kashierTransactionIds: { $ne: transactionId } },
        { $addToSet: { kashierTransactionIds: transactionId } },
      );
      if (!claimed) {
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
      .select("amountEgp userId")
      .lean<{
        _id: Types.ObjectId;
        amountEgp: number;
        userId: Types.ObjectId;
      }>();
    if (legacyBooking) {
      if (receivedAmount !== legacyBooking.amountEgp) {
        return NextResponse.json(
          { error: "Invalid payment details" },
          { status: 400 },
        );
      }
      const settled = await Request.findOneAndUpdate(
        {
          _id: orderId,
          paymentStatus: { $in: ["pending", "failed"] },
          kashierTransactionIds: { $ne: transactionId },
        },
        paid
          ? {
              $set: {
                paymentStatus: "paid",
                status: "submitted",
                paidAt: new Date(),
              },
              $addToSet: { kashierTransactionIds: transactionId },
            }
          : {
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
      if (paid) {
        await Trip.updateMany(
          { requestId: settled._id },
          { paymentStatus: "paid", status: "submitted" },
        );
        await createNotification({
          userId: String(settled.userId),
          type: "payment_paid",
          title: "Payment completed",
          body: "Your booking payment was successful.",
          data: { bookingId: String(settled._id) },
        });
      } else {
        await createNotification({
          userId: String(settled.userId),
          type: "payment_failed",
          title: "Payment issue",
          body: "We couldn’t confirm your payment. You can try again from your requests page.",
          data: { bookingId: String(settled._id) },
        });
      }
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
): Promise<void> {
  const payment = await Payment.findOne({
    _id: paymentId,
    overallStatus: { $in: ["wallet_reserved", "kashier_pending", "created"] },
  });
  if (!payment) return;

  if (paid) {
    if (payment.walletReservationTxId && payment.walletStatus === "reserved") {
      const captured = await captureReservation(
        String(payment.walletReservationTxId),
        {
          description: `Payment for booking ${payment.bookingId}`,
          paymentId: String(payment._id),
          bookingId: String(payment.bookingId),
        },
      );
      if (captured === null) {
        // Retryable — leave in kashier_pending for verify path.
        return;
      }
    }

    const settled = await Request.findOneAndUpdate(
      {
        _id: payment.bookingId,
        paymentStatus: { $in: ["pending", "failed"] },
      },
      {
        $set: {
          paymentStatus: "paid",
          status: "submitted",
          paidAt: new Date(),
        },
      },
    );

    await Payment.updateOne(
      { _id: payment._id },
      {
        $set: {
          gatewayStatus: "success",
          walletStatus:
            payment.walletAmountEgp > 0 ? "captured" : payment.walletStatus,
          overallStatus: "paid",
          paidAt: new Date(),
        },
        $push: {
          timeline: {
            $each: [
              { event: "kashier_success", detail: transactionId },
              { event: "wallet_captured" },
              { event: "booking_paid" },
            ],
          },
        },
      },
    );

    if (payment.gatewayAmountEgp > 0) {
      await writeKashierPaymentLedger(payment, transactionId);
    }

    if (settled) {
      await Trip.updateMany(
        { requestId: payment.bookingId },
        { paymentStatus: "paid", status: "submitted" },
      );
      await createNotification({
        userId: String(payment.userId),
        type: "payment_paid",
        title: "Payment completed",
        body: "Your booking payment was successful.",
        data: {
          bookingId: String(payment.bookingId),
          paymentId: String(payment._id),
        },
      });
    }
    return;
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

// Idempotent ledger write for the Kashier (gateway) leg of a Payment.
async function writeKashierPaymentLedger(
  payment: {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    bookingId: Types.ObjectId;
    gatewayAmountEgp: number;
    kashierSessionId?: string | null;
    kashierOrderId?: string | null;
  },
  transactionId: string,
): Promise<void> {
  await WalletTransaction.updateOne(
    { paymentId: payment._id, type: "kashier_payment" },
    {
      $setOnInsert: {
        userId: payment.userId,
        type: "kashier_payment",
        amountEgp: payment.gatewayAmountEgp,
        status: "completed",
        description: `Card payment via Kashier for booking ${payment.bookingId}`,
        paymentId: payment._id,
        bookingId: payment.bookingId,
        kashierSessionId: payment.kashierSessionId ?? undefined,
        kashierOrderId: payment.kashierOrderId ?? undefined,
      },
      $addToSet: { kashierTransactionIds: transactionId },
    },
    { upsert: true },
  );
}
