import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { expireStaleForUser, listUserRequests } from "@/lib/services/requests";
import type { BookingStatus, PaymentStatus } from "@/types/booking";

const PAYMENT_STATUSES = new Set<PaymentStatus>([
  "pending",
  "paid",
  "failed",
  "refunded",
  "expired",
]);
const BOOKING_STATUSES = new Set<BookingStatus>([
  "pending_payment",
  "submitted",
  "matched",
  "confirmed",
  "active",
  "completed",
  "cancelled",
  "time_out",
]);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const payment = searchParams.get("paymentStatus");
  const status = searchParams.get("status");
  if (payment && !PAYMENT_STATUSES.has(payment as PaymentStatus))
    return NextResponse.json(
      { error: "Invalid paymentStatus" },
      { status: 400 },
    );
  if (status && !BOOKING_STATUSES.has(status as BookingStatus))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  await expireStaleForUser(session.userId);
  const result = await listUserRequests(session.userId, {
    page,
    paymentStatus: payment as PaymentStatus | undefined,
    status: status as BookingStatus | undefined,
  });
  return NextResponse.json({
    data: result.rows,
    page: result.page,
    pageSize: 8,
    total: result.total,
    totalPages: Math.ceil(result.total / 8),
  });
}
