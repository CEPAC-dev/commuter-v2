import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { WalletTransaction } from "@/models/WalletTransaction";
import { Payment } from "@/models/Payment";
import { User } from "@/models/User";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Match server-side filters + build MongoDB query from query params. Shared
// with the export route so filters stay identical.
export interface TxFilters {
  search?: string;
  status?: string[];
  type?: string[];
  paymentMethod?: "wallet" | "kashier" | "mixed" | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  userId?: string | null;
  bookingId?: string | null;
}

export function parseFilters(sp: URLSearchParams): TxFilters {
  const parseNum = (v: string | null) => {
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const parseDate = (v: string | null) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const many = (key: string) => sp.getAll(key).filter(Boolean);
  return {
    search: sp.get("search")?.trim() || undefined,
    status: many("status"),
    type: many("type"),
    paymentMethod:
      (sp.get("paymentMethod") as TxFilters["paymentMethod"]) || null,
    dateFrom: parseDate(sp.get("dateFrom")),
    dateTo: parseDate(sp.get("dateTo")),
    minAmount: parseNum(sp.get("minAmount")),
    maxAmount: parseNum(sp.get("maxAmount")),
    userId: sp.get("userId") || null,
    bookingId: sp.get("bookingId") || null,
  };
}

export async function buildTxQuery(
  f: TxFilters,
): Promise<Record<string, unknown>> {
  const q: Record<string, unknown> = {};
  if (f.status && f.status.length) q.status = { $in: f.status };
  if (f.type && f.type.length) q.type = { $in: f.type };
  if (f.userId && Types.ObjectId.isValid(f.userId))
    q.userId = new Types.ObjectId(f.userId);
  if (f.bookingId && Types.ObjectId.isValid(f.bookingId))
    q.bookingId = new Types.ObjectId(f.bookingId);
  if (f.dateFrom || f.dateTo) {
    const range: Record<string, Date> = {};
    if (f.dateFrom) range.$gte = f.dateFrom;
    if (f.dateTo) range.$lte = f.dateTo;
    q.createdAt = range;
  }
  if (f.minAmount != null || f.maxAmount != null) {
    const range: Record<string, number> = {};
    if (f.minAmount != null) range.$gte = f.minAmount;
    if (f.maxAmount != null) range.$lte = f.maxAmount;
    q.amountEgp = range;
  }
  if (f.search) {
    const s = f.search;
    const or: Record<string, unknown>[] = [
      { description: { $regex: s, $options: "i" } },
      { kashierOrderId: s },
      { kashierPayoutId: s },
      { kashierTransactionIds: s },
    ];
    if (Types.ObjectId.isValid(s)) {
      or.push({ _id: new Types.ObjectId(s) });
      or.push({ paymentId: new Types.ObjectId(s) });
      or.push({ bookingId: new Types.ObjectId(s) });
      or.push({ userId: new Types.ObjectId(s) });
    }
    // Match by user email/phone (single indirection).
    const users = await User.find({
      $or: [
        { email: { $regex: s, $options: "i" } },
        { phone: { $regex: s, $options: "i" } },
        { name: { $regex: s, $options: "i" } },
      ],
    })
      .select("_id")
      .limit(50)
      .lean<{ _id: Types.ObjectId }[]>();
    if (users.length) {
      or.push({ userId: { $in: users.map((u) => u._id) } });
    }
    q.$or = or;
  }
  if (f.paymentMethod) {
    // Wallet method = ledger types that mutate wallet directly; Kashier method
    // = topup/withdrawal/gateway-linked; mixed = payment_reserved/captured/released with paymentId.
    if (f.paymentMethod === "wallet") {
      q.type = {
        $in: [
          "payment",
          "refund",
          "earning",
          "referral_bonus",
          "payment_captured",
          "payment_released",
          "payment_reserved",
        ],
      };
    } else if (f.paymentMethod === "kashier") {
      q.type = {
        $in: [
          "topup",
          "withdrawal",
          "kashier_payment",
          "payment_refund_partial",
        ],
      };
    } else if (f.paymentMethod === "mixed") {
      q.paymentId = { $exists: true, $ne: null };
    }
  }
  return q;
}

export async function GET(req: NextRequest) {
  const auth = await adminAuth(PERMISSIONS.TRANSACTIONS_VIEW);
  if (!auth.authorized) return auth.response;

  await connectDB();

  const sp = req.nextUrl.searchParams;
  const filters = parseFilters(sp);
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit") ?? 25) || 25));

  const query = await buildTxQuery(filters);

  const [total, rows] = await Promise.all([
    WalletTransaction.countDocuments(query),
    WalletTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<Record<string, unknown>[]>(),
  ]);

  // Batch-fetch related User + Payment for the returned page.
  const userIds = Array.from(
    new Set(rows.map((r) => String(r.userId)).filter(Boolean)),
  );
  const paymentIds = Array.from(
    new Set(
      rows.map((r) => (r.paymentId ? String(r.paymentId) : "")).filter(Boolean),
    ),
  );
  const [users, payments] = await Promise.all([
    User.find({ _id: { $in: userIds } })
      .select("name email phone")
      .lean<
        { _id: Types.ObjectId; name: string; email?: string; phone?: string }[]
      >(),
    Payment.find({ _id: { $in: paymentIds } })
      .select(
        "totalEgp walletAmountEgp gatewayAmountEgp overallStatus bookingId",
      )
      .lean<Record<string, unknown>[]>(),
  ]);
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const paymentMap = new Map(payments.map((p) => [String(p._id), p]));

  return NextResponse.json({
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    transactions: rows.map((r) => {
      const u = userMap.get(String(r.userId));
      const p = r.paymentId ? paymentMap.get(String(r.paymentId)) : null;
      return {
        id: String(r._id),
        type: r.type,
        status: r.status,
        amountEgp: r.amountEgp,
        currency: "EGP",
        description: r.description,
        balanceAfterEgp: r.balanceAfterEgp ?? null,
        createdAt: r.createdAt,
        userId: r.userId ? String(r.userId) : null,
        userName: u?.name ?? null,
        userEmail: u?.email ?? null,
        userPhone: u?.phone ?? null,
        bookingId: r.bookingId ? String(r.bookingId) : null,
        paymentId: r.paymentId ? String(r.paymentId) : null,
        tripId: r.tripId ? String(r.tripId) : null,
        kashierOrderId: r.kashierOrderId ?? null,
        kashierTransactionIds: r.kashierTransactionIds ?? [],
        payment: p
          ? {
              totalEgp: p.totalEgp,
              walletAmountEgp: p.walletAmountEgp,
              gatewayAmountEgp: p.gatewayAmountEgp,
              overallStatus: p.overallStatus,
            }
          : null,
      };
    }),
  });
}
