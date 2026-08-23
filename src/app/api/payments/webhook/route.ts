import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { WalletTransaction } from "@/models/WalletTransaction";
import { verifyAndSettleTopup } from "@/lib/payments/kashier";
import { completeWithdrawal, refundWithdrawal } from "@/lib/wallet/wallet";
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

  const bookingId = body.merchantOrderId ?? body.orderId;
  const amount = body.amount;
  const currency = body.currency;
  const merchantId = body.merchantId;
  const transactionId = body.transactionId;
  const paymentStatus = body.paymentStatus ?? body.status;
  const sig = body.signature || req.headers.get("x-kashier-signature") || "";
  const webhookSecret = process.env.KASHIER_SECRET_KEY;
  const expectedMerchantId = process.env.KASHIER_MERCHANT_ID;

  if (
    !bookingId ||
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
    return NextResponse.json({ error: "Invalid payment details" }, { status: 400 });
  }

  await connectDB();

  const orderId = bookingId; // merchantOrderId = Booking _id OR WalletTransaction _id
  const receivedAmount = Number(amount);
  if (!Number.isFinite(receivedAmount)) {
    return NextResponse.json({ error: "Invalid payment details" }, { status: 400 });
  }

  // Route by record type: wallet top-ups are settled (and credited) separately.
  if (Types.ObjectId.isValid(orderId)) {
    const topup = await WalletTransaction.findOne({
      _id: orderId,
      type: "topup",
    });
    if (topup) {
      if (receivedAmount !== topup.amountEgp) {
        return NextResponse.json({ error: "Invalid payment details" }, { status: 400 });
      }
      const claimed = await WalletTransaction.findOneAndUpdate(
        {
          _id: topup._id,
          kashierTransactionIds: { $ne: transactionId },
        },
        { $addToSet: { kashierTransactionIds: transactionId } },
      );
      if (!claimed) {
        return NextResponse.json({ error: "Transaction already processed" }, { status: 400 });
      }
      // Re-query Kashier (source of truth) and credit once if paid.
      await verifyAndSettleTopup(orderId);
      return NextResponse.json({ received: true });
    }

    const withdrawal = await WalletTransaction.findOne({
      _id: orderId,
      type: "withdrawal",
    });
    if (withdrawal) {
      if (receivedAmount !== withdrawal.amountEgp) {
        return NextResponse.json({ error: "Invalid payment details" }, { status: 400 });
      }
      const claimed = await WalletTransaction.findOneAndUpdate(
        {
          _id: withdrawal._id,
          kashierTransactionIds: { $ne: transactionId },
        },
        { $addToSet: { kashierTransactionIds: transactionId } },
      );
      if (!claimed) {
        return NextResponse.json({ error: "Transaction already processed" }, { status: 400 });
      }
      const payoutId = withdrawal.kashierPayoutId;
      if (payoutId) {
        const outcome = await queryKashierPayoutStatus(payoutId);
        if (outcome === "completed") {
          await completeWithdrawal(orderId, payoutId);
        } else if (outcome === "failed") {
          await refundWithdrawal(orderId);
        }
      }
      return NextResponse.json({ received: true });
    }
  }

  const st = paymentStatus.toLowerCase();
  const paid = [
    "success",
    "captured",
    "paid",
    "complete",
    "completed",
  ].includes(st);

  const booking = Types.ObjectId.isValid(orderId)
    ? await Request.findById(orderId).select("amountEgp").lean<{ amountEgp: number }>()
    : null;
  if (!booking || receivedAmount !== booking.amountEgp) {
    return NextResponse.json({ error: "Invalid payment details" }, { status: 400 });
  }

  // Conditional update — only settle if still unsettled (race-safe vs wallet path)
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
    return NextResponse.json({ error: "Transaction already processed" }, { status: 400 });
  }

  // Sync Trips only when Request was actually updated (idempotent guard).
  if (settled && paid) {
    await Trip.updateMany(
      { requestId: settled._id },
      { paymentStatus: "paid", status: "submitted" },
    );
    await createNotification({
      userId: String(settled.userId),
      type: "payment_paid",
      title: "Payment completed",
      body: "Your booking payment was successful. We’ll keep you updated on your trip status.",
      data: { bookingId: String(settled._id) },
    });
  } else if (settled && !paid) {
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
