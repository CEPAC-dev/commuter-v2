import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { WalletTransaction } from "@/models/WalletTransaction";
import { creditWallet } from "@/lib/wallet/wallet";
import { refundKashierPayment } from "@/lib/payments/kashier";
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
  let amountEgp: number;
  let reason: string | undefined;
  try {
    const body = await req.json();
    paymentId = body.paymentId;
    amountEgp = Number(body.amountEgp);
    reason = typeof body.reason === "string" ? body.reason : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!paymentId || !Types.ObjectId.isValid(paymentId))
    return NextResponse.json({ error: "Invalid paymentId" }, { status: 400 });
  if (!Number.isFinite(amountEgp) || amountEgp <= 0)
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

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

  const alreadyRefunded = payment.refundedAmountEgp ?? 0;
  const refundableTotal = payment.totalEgp - alreadyRefunded;
  if (amountEgp > refundableTotal)
    return NextResponse.json(
      {
        error: `Refund exceeds remaining refundable amount (${refundableTotal} EGP).`,
      },
      { status: 400 },
    );

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
    if (!payment.kashierOrderId) {
      gatewayRefundFailed = true;
      timelineEvents.push({ event: "kashier_refund_skipped_no_order" });
    } else {
      const result = await refundKashierPayment(
        payment.kashierOrderId,
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
          kashierOrderId: payment.kashierOrderId,
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
  const fullyRefunded = newRefundedTotal >= payment.totalEgp;

  const update: Record<string, unknown> = {
    refundedAt: new Date(),
    refundedAmountEgp: newRefundedTotal,
    overallStatus: fullyRefunded ? "refunded" : "partially_refunded",
  };
  if (walletRefundEgp > 0 && fullyRefunded) update.walletStatus = "refunded";
  if (gatewayRefundEgp > 0 && !gatewayRefundFailed && fullyRefunded)
    update.gatewayStatus = "refunded";

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

  return NextResponse.json({
    ok: true,
    refundedAmountEgp:
      walletRefundEgp + (gatewayRefundFailed ? 0 : gatewayRefundEgp),
    walletRefundEgp,
    gatewayRefundEgp: gatewayRefundFailed ? 0 : gatewayRefundEgp,
    gatewayRefundFailed,
    kashierRefundId,
    overallStatus: update.overallStatus,
  });
}
