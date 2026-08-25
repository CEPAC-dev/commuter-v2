import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { WalletTransaction } from "@/models/WalletTransaction";
import { User } from "@/models/User";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { parseFilters, buildTxQuery } from "../route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = [
  "Transaction Reference",
  "Date",
  "User ID",
  "User Name",
  "User Email",
  "User Phone",
  "Trip ID",
  "Booking ID",
  "Payment ID",
  "Type",
  "Amount",
  "Currency",
  "Status",
  "Kashier Order",
  "Kashier Transactions",
  "Description",
];

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const auth = await adminAuth(PERMISSIONS.TRANSACTIONS_EXPORT);
  if (!auth.authorized) return auth.response;

  await connectDB();
  const filters = parseFilters(req.nextUrl.searchParams);
  const query = await buildTxQuery(filters);

  const cursor = WalletTransaction.find(query).sort({ createdAt: -1 }).cursor();

  const encoder = new TextEncoder();
  const userCache = new Map<
    string,
    { name?: string; email?: string; phone?: string }
  >();

  async function userFor(id: unknown) {
    if (!id) return null;
    const key = String(id);
    if (userCache.has(key)) return userCache.get(key)!;
    const u = await User.findById(id)
      .select("name email phone")
      .lean<{ name?: string; email?: string; phone?: string } | null>();
    const entry = u ?? {};
    userCache.set(key, entry);
    return entry;
  }

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(HEADERS.map(csvCell).join(",") + "\n"));
      for await (const doc of cursor as unknown as AsyncIterable<
        Record<string, unknown>
      >) {
        const u = (await userFor(doc.userId)) ?? {};
        const row = [
          String(doc._id),
          doc.createdAt instanceof Date
            ? (doc.createdAt as Date).toISOString()
            : String(doc.createdAt ?? ""),
          doc.userId ? String(doc.userId) : "",
          u.name ?? "",
          u.email ?? "",
          u.phone ?? "",
          doc.tripId ? String(doc.tripId) : "",
          doc.bookingId ? String(doc.bookingId) : "",
          doc.paymentId ? String(doc.paymentId) : "",
          doc.type ?? "",
          doc.amountEgp ?? "",
          "EGP",
          doc.status ?? "",
          doc.kashierOrderId ?? "",
          Array.isArray(doc.kashierTransactionIds)
            ? (doc.kashierTransactionIds as string[]).join(";")
            : "",
          doc.description ?? "",
        ];
        controller.enqueue(encoder.encode(row.map(csvCell).join(",") + "\n"));
      }
      controller.close();
    },
  });

  const fname = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
