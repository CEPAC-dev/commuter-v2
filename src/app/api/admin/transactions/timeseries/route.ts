import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { WalletTransaction } from "@/models/WalletTransaction";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Daily revenue + transaction-count series for the Transactions page chart. Real data only. */
export async function GET(req: NextRequest) {
  const auth = await adminAuth(PERMISSIONS.TRANSACTIONS_REPORTS);
  if (!auth.authorized) return auth.response;

  await connectDB();
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 30, 1), 90);
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const [collected, byType] = await Promise.all([
    WalletTransaction.aggregate([
      { $match: { createdAt: { $gte: since }, type: "payment_captured", status: "completed" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          sumEgp: { $sum: "$amountEgp" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    WalletTransaction.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const byDate = new Map(collected.map((row) => [row._id as string, row]));
  const series: { date: string; sumEgp: number; count: number }[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = byDate.get(key);
    series.push({ date: key, sumEgp: row?.sumEgp ?? 0, count: row?.count ?? 0 });
  }

  return NextResponse.json({
    series,
    byType: byType.map((row) => ({ type: row._id as string, count: row.count as number })),
  });
}
