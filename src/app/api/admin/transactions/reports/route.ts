import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { WalletTransaction } from "@/models/WalletTransaction";
import { Payment } from "@/models/Payment";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Financial reports. All aggregates are computed from COMPLETED / SUCCESS
 * statuses only — reserved and pending money is reported separately, never
 * mixed into "collected" totals.
 */
export async function GET(req: NextRequest) {
  const auth = await adminAuth(PERMISSIONS.TRANSACTIONS_REPORTS);
  if (!auth.authorized) return auth.response;

  await connectDB();
  const sp = req.nextUrl.searchParams;
  const dateFrom = sp.get("dateFrom") ? new Date(sp.get("dateFrom")!) : null;
  const dateTo = sp.get("dateTo") ? new Date(sp.get("dateTo")!) : null;

  const range: Record<string, Date> = {};
  if (dateFrom && !Number.isNaN(dateFrom.getTime())) range.$gte = dateFrom;
  if (dateTo && !Number.isNaN(dateTo.getTime())) range.$lte = dateTo;
  const dateMatch = Object.keys(range).length ? { createdAt: range } : {};

  const [
    walletCollected,
    kashierCollected,
    refunds,
    reservationsHeld,
    pending,
    failed,
    byType,
    paidPayments,
  ] = await Promise.all([
    WalletTransaction.aggregate([
      {
        $match: { ...dateMatch, type: "payment_captured", status: "completed" },
      },
      {
        $group: { _id: null, sum: { $sum: "$amountEgp" }, count: { $sum: 1 } },
      },
    ]),
    Payment.aggregate([
      { $match: { ...dateMatch, overallStatus: "paid" } },
      {
        $group: {
          _id: null,
          sum: { $sum: "$gatewayAmountEgp" },
          count: { $sum: 1 },
        },
      },
    ]),
    WalletTransaction.aggregate([
      {
        $match: {
          ...dateMatch,
          type: { $in: ["refund", "payment_refund_partial"] },
          status: "completed",
        },
      },
      {
        $group: { _id: null, sum: { $sum: "$amountEgp" }, count: { $sum: 1 } },
      },
    ]),
    WalletTransaction.aggregate([
      { $match: { ...dateMatch, type: "payment_reserved", status: "pending" } },
      {
        $group: { _id: null, sum: { $sum: "$amountEgp" }, count: { $sum: 1 } },
      },
    ]),
    WalletTransaction.countDocuments({ ...dateMatch, status: "pending" }),
    WalletTransaction.countDocuments({ ...dateMatch, status: "failed" }),
    WalletTransaction.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: { type: "$type", status: "$status" },
          sum: { $sum: "$amountEgp" },
          count: { $sum: 1 },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { ...dateMatch, overallStatus: "paid" } },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: "$totalEgp" },
          walletPortion: { $sum: "$walletAmountEgp" },
          gatewayPortion: { $sum: "$gatewayAmountEgp" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  return NextResponse.json({
    dateFrom: dateFrom?.toISOString() ?? null,
    dateTo: dateTo?.toISOString() ?? null,
    // Completed (settled) money only.
    completed: {
      walletVolumeEgp: walletCollected[0]?.sum ?? 0,
      walletTxCount: walletCollected[0]?.count ?? 0,
      kashierVolumeEgp: kashierCollected[0]?.sum ?? 0,
      kashierTxCount: kashierCollected[0]?.count ?? 0,
      totalCollectedEgp: paidPayments[0]?.totalCollected ?? 0,
      paidPaymentsCount: paidPayments[0]?.count ?? 0,
    },
    refunds: {
      totalRefundedEgp: refunds[0]?.sum ?? 0,
      refundCount: refunds[0]?.count ?? 0,
    },
    inflight: {
      reservedEgp: reservationsHeld[0]?.sum ?? 0,
      reservationCount: reservationsHeld[0]?.count ?? 0,
      pendingTxCount: pending,
    },
    failures: { failedTxCount: failed },
    net: {
      netCollectedEgp:
        (paidPayments[0]?.totalCollected ?? 0) - (refunds[0]?.sum ?? 0),
    },
    breakdown: byType.map((b) => ({
      type: b._id.type,
      status: b._id.status,
      sumEgp: b.sum,
      count: b.count,
    })),
  });
}
