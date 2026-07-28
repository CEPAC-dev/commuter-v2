import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { WalletTransaction } from "@/models/WalletTransaction";
import { verifyAndSettleTopup } from "@/lib/payments/kashier";
import {
  completeWithdrawal,
  refundWithdrawal,
} from "@/lib/wallet/wallet";
import { queryKashierPayoutStatus } from "@/lib/payments/kashierPayout";
import { Types } from "mongoose";

function verifySignature(p: Record<string, string>, sig: string): boolean {
  const secret = process.env.KASHIER_SECRET_KEY!;
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
  const paymentStatus = body.paymentStatus ?? body.status;
  const sig = body.signature || req.headers.get("x-kashier-signature") || "";

  if (!bookingId || !amount || !paymentStatus) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (sig && process.env.KASHIER_SECRET_KEY && !verifySignature(body, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  await connectDB();

  const orderId = bookingId; // merchantOrderId = Booking _id OR WalletTransaction _id

  // Route by record type: wallet top-ups are settled (and credited) separately.
  if (Types.ObjectId.isValid(orderId)) {
    const topup = await WalletTransaction.findOne({
      _id: orderId,
      type: "topup",
    });
    if (topup) {
      // Re-query Kashier (source of truth) and credit once if paid.
      await verifyAndSettleTopup(orderId);
      return NextResponse.json({ received: true });
    }

    const withdrawal = await WalletTransaction.findOne({
      _id: orderId,
      type: "withdrawal",
    });
    if (withdrawal) {
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

  // Conditional update — only settle if still unsettled (race-safe vs wallet path)
  const settled = await Request.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $in: ["pending", "failed"] } },
    paid
      ? { paymentStatus: "paid", status: "submitted", paidAt: new Date() }
      : { paymentStatus: "failed" },
  );

  // Sync Trips only when Request was actually updated (idempotent guard).
  if (settled && paid) {
    await Trip.updateMany(
      { requestId: settled._id },
      { paymentStatus: "paid", status: "submitted" },
    );
  }

  return NextResponse.json({ received: true });
}
