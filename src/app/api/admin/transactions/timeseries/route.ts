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
  const searchParams = req.nextUrl.searchParams;
  const dateFromParam = searchParams.get("dateFrom");
  const dateToParam = searchParams.get("dateTo");
  const parsedFrom = dateFromParam
    ? new Date(`${dateFromParam}T00:00:00.000Z`)
    : null;
  const parsedTo = dateToParam
    ? new Date(`${dateToParam}T23:59:59.999Z`)
    : null;
  const hasValidFrom = parsedFrom && !Number.isNaN(parsedFrom.getTime());
  const hasValidTo = parsedTo && !Number.isNaN(parsedTo.getTime());

  const since = hasValidFrom ? new Date(parsedFrom) : new Date();
  if (!hasValidFrom) since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);
  const until = hasValidTo ? new Date(parsedTo) : new Date();
  until.setHours(23, 59, 59, 999);
  if (until < since) {
    return NextResponse.json(
      { error: "dateTo must be on or after dateFrom" },
      { status: 400 },
    );
  }
  const days = Math.floor((until.getTime() - since.getTime()) / 86_400_000) + 1;
  if (days > 366) {
    return NextResponse.json(
      { error: "Date range cannot exceed 366 days" },
      { status: 400 },
    );
  }
  const dateMatch = { createdAt: { $gte: since, $lte: until } };

  const [collected, byType] = await Promise.all([
    WalletTransaction.aggregate([
      {
        $match: { ...dateMatch, type: "payment_captured", status: "completed" },
      },
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
      { $match: dateMatch },
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
    series.push({
      date: key,
      sumEgp: row?.sumEgp ?? 0,
      count: row?.count ?? 0,
    });
  }

  return NextResponse.json({
    series,
    byType: byType.map((row) => ({
      type: row._id as string,
      count: row.count as number,
    })),
  });
}
