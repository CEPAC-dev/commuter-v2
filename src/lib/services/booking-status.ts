import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import type { BookingStatus, PaymentStatus, TripStatus } from "@/types/booking";
import { resolvePayableBooking } from "@/lib/payments/resolveBooking";

export interface BookingStatusDetail {
  id: string;
  paymentStatus: PaymentStatus;
  amountEgp: number;
  status: BookingStatus | TripStatus;
  dates: string[];
}

export async function getBookingStatus(
  userId: string,
  bookingId: string,
): Promise<BookingStatusDetail | null> {
  if (!Types.ObjectId.isValid(bookingId)) return null;

  await connectDB();
  const booking = await resolvePayableBooking(bookingId, userId);
  if (!booking) return null;

  return {
    id: String(booking.doc._id),
    paymentStatus: (booking.paymentStatus as PaymentStatus) ?? "pending",
    amountEgp: booking.amountEgp,
    status: booking.status as BookingStatus | TripStatus,
    dates:
      booking.kind === "trip"
        ? [booking.doc.date]
        : booking.doc.dates ?? [],
  };
}
