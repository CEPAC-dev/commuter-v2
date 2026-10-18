import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { WalletTransaction } from "@/models/WalletTransaction";
import { Payment } from "@/models/Payment";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Types } from "mongoose";
import { resolvePayableBooking } from "@/lib/payments/resolveBooking";

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

  const walletTransaction = await WalletTransaction.findById(id).lean<
    Record<string, unknown> | null
  >();
  const paymentCandidate = walletTransaction
    ? null
    : await Payment.findById(id).lean<Record<string, unknown> | null>();
  const paymentTimeline = paymentCandidate?.timeline as
    | { event?: string }[]
    | undefined;
  const paymentHasLateCharge = paymentTimeline?.some((event) =>
    [
      "blocked_trip_payment_webhook",
      "blocked_trip_payment_callback",
      "request_payment_manual_review",
      "request_payment_amount_mismatch",
    ].includes(event.event ?? ""),
  );
  const paymentForId = paymentHasLateCharge ? paymentCandidate : null;
  const tx =
    walletTransaction ??
    (paymentForId
      ? ({
          _id: paymentForId._id,
          type: "kashier_payment",
          status: "completed",
          amountEgp: paymentForId.gatewayAmountEgp,
          description: "Kashier payment flagged for manual review.",
          balanceAfterEgp: null,
          createdAt: paymentForId.createdAt,
          kashierOrderId: paymentForId.kashierOrderId,
          kashierTransactionIds: paymentForId.kashierTransactionIds,
          userId: paymentForId.userId,
          bookingId: paymentForId.bookingId,
          paymentId: paymentForId._id,
        } as Record<string, unknown>)
      : null);
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // This admin detail lookup intentionally skips userId. Standalone Trips
  // resolve first; Request-backed payments fall back through the shared helper.
  const booking = tx.bookingId
    ? await resolvePayableBooking(String(tx.bookingId))
    : null;

  const [user, payment, trips] = await Promise.all([
    tx.userId
      ? User.findById(tx.userId)
          .select("name email phone role")
          .lean<Record<string, unknown> | null>()
      : null,
    tx.paymentId
      ? Payment.findById(tx.paymentId).lean<Record<string, unknown> | null>()
      : null,
    tx.bookingId && booking
      ? booking.kind === "trip"
        ? Trip.find({ _id: booking.doc._id, requestId: null })
            .select(
              "tripNumber date cycleIndex pickup.address dropoff.address vehicleType rideType pickupTime arrivalTime priceEgp paymentStatus status cancellation adminRefund",
            )
            .lean<Record<string, unknown>[]>()
        : Trip.find({ requestId: tx.bookingId })
          .select(
            "tripNumber date cycleIndex pickup.address dropoff.address vehicleType rideType pickupTime arrivalTime priceEgp preferedGender paymentStatus status cancellation adminRefund",
          )
          .sort({ date: 1, cycleIndex: 1 })
          .lean<Record<string, unknown>[]>()
      : [],
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
          dates:
            booking.kind === "trip"
              ? [booking.doc.date]
              : booking.doc.dates,
          note: booking.doc.note,
        }
      : null,
    trips: trips.map((trip) => ({
      id: String(trip._id),
      tripNumber: trip.tripNumber ?? null,
      date: trip.date,
      cycleIndex: trip.cycleIndex,
      pickup: (trip.pickup as { address?: string } | undefined)?.address ?? "—",
      dropoff: (trip.dropoff as { address?: string } | undefined)?.address ?? "—",
      vehicleType: trip.vehicleType,
      rideType: trip.rideType,
      pickupTime: trip.pickupTime,
      arrivalTime: trip.arrivalTime,
      priceEgp: trip.priceEgp,
      preferedGender: trip.preferedGender ?? null,
      paymentStatus: trip.paymentStatus,
      status: trip.status,
      cancellation: trip.cancellation ?? null,
      adminRefund: trip.adminRefund ?? null,
    })),
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
          lateGatewayCharge: (payment.timeline as {
            event?: string;
          }[] | undefined)?.some((event) =>
            [
              "blocked_trip_payment_webhook",
              "blocked_trip_payment_callback",
              "request_payment_manual_review",
              "request_payment_amount_mismatch",
            ].includes(event.event ?? ""),
          ) ?? false,
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
