import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { WalletTransaction } from "@/models/WalletTransaction";
import { Payment } from "@/models/Payment";
import { Request } from "@/models/Request";
import { User } from "@/models/User";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(PERMISSIONS.TRANSACTIONS_DETAILS);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  if (!id || !Types.ObjectId.isValid(id))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await connectDB();

  const tx = await WalletTransaction.findById(id).lean<Record<
    string,
    unknown
  > | null>();
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [user, payment, booking] = await Promise.all([
    tx.userId
      ? User.findById(tx.userId)
          .select("name email phone role")
          .lean<Record<string, unknown> | null>()
      : null,
    tx.paymentId
      ? Payment.findById(tx.paymentId).lean<Record<string, unknown> | null>()
      : null,
    tx.bookingId
      ? Request.findById(tx.bookingId)
          .select("amountEgp paymentStatus status dates note")
          .lean<Record<string, unknown> | null>()
      : null,
  ]);

  // If we have a Payment, include all its related ledger rows so the
  // frontend can render the full financial breakdown.
  let siblings: Record<string, unknown>[] = [];
  if (payment) {
    siblings = await WalletTransaction.find({ paymentId: payment._id })
      .sort({ createdAt: 1 })
      .lean<Record<string, unknown>[]>();
  }

  // Build a unified timeline: Payment.timeline events + sibling ledger rows.
  const timeline: {
    at: Date | string;
    event: string;
    detail?: string;
    ref?: string;
  }[] = [];
  for (const ev of (payment?.timeline as {
    at: Date;
    event: string;
    detail?: string;
  }[]) ?? []) {
    timeline.push({ at: ev.at, event: ev.event, detail: ev.detail });
  }
  for (const s of siblings) {
    timeline.push({
      at: s.createdAt as Date,
      event: `ledger_${s.type}_${s.status}`,
      detail: `${s.amountEgp} EGP`,
      ref: String(s._id),
    });
  }
  timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return NextResponse.json({
    transaction: {
      id: String(tx._id),
      type: tx.type,
      status: tx.status,
      amountEgp: tx.amountEgp,
      currency: "EGP",
      description: tx.description,
      balanceAfterEgp: tx.balanceAfterEgp ?? null,
      createdAt: tx.createdAt,
      kashierOrderId: tx.kashierOrderId ?? null,
      kashierTransactionIds: tx.kashierTransactionIds ?? [],
    },
    user: user
      ? {
          id: String(user._id),
          name: user.name,
          email: user.email ?? null,
          phone: user.phone ?? null,
          role: user.role,
        }
      : null,
    booking: booking
      ? {
          id: tx.bookingId ? String(tx.bookingId) : null,
          amountEgp: booking.amountEgp,
          paymentStatus: booking.paymentStatus,
          status: booking.status,
          dates: booking.dates,
          note: booking.note,
        }
      : null,
    payment: payment
      ? {
          id: String(payment._id),
          totalEgp: payment.totalEgp,
          walletAmountEgp: payment.walletAmountEgp,
          gatewayAmountEgp: payment.gatewayAmountEgp,
          walletStatus: payment.walletStatus,
          gatewayStatus: payment.gatewayStatus,
          overallStatus: payment.overallStatus,
          paidAt: payment.paidAt,
          refundedAt: payment.refundedAt,
          refundedAmountEgp: payment.refundedAmountEgp ?? 0,
          kashierSessionId: payment.kashierSessionId ?? null,
          kashierOrderId: payment.kashierOrderId ?? null,
          kashierTransactionIds: payment.kashierTransactionIds ?? [],
          kashierRefundIds: payment.kashierRefundIds ?? [],
        }
      : null,
    ledger: siblings.map((s) => ({
      id: String(s._id),
      type: s.type,
      status: s.status,
      amountEgp: s.amountEgp,
      description: s.description,
      balanceAfterEgp: s.balanceAfterEgp ?? null,
      createdAt: s.createdAt,
    })),
    timeline,
  });
}
