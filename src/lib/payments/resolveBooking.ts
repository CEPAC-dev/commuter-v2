import { Types } from "mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { isTripSettlementBlockedStatus } from "@/lib/payments/tripSettlement";
import {
  isApprovedTripPickupPast,
  resolvePayableBookingWith,
} from "@/lib/payments/resolvePayableBookingRecord";
export {
  isApprovedTripPickupPast,
  isStandaloneTripPayable,
  isStandaloneTripRecord,
  resolvePayableBookingWith,
} from "@/lib/payments/resolvePayableBookingRecord";

export type PayableBooking =
  | {
      kind: "trip";
      doc: ReturnType<typeof Trip.hydrate>;
      amountEgp: number;
      paymentStatus: string;
      status: string;
    }
  | {
      kind: "request";
      doc: ReturnType<typeof Request.hydrate>;
      amountEgp: number;
      paymentStatus: string;
      status: string;
    };

export async function resolvePayableBooking(
  bookingId: string,
  userId?: string,
): Promise<PayableBooking | null> {
  if (!Types.ObjectId.isValid(bookingId)) return null;

  const ownerFilter = userId
    ? { userId: new Types.ObjectId(userId) }
    : {};
  return resolvePayableBookingWith(
    () =>
      Trip.findOne({
        _id: new Types.ObjectId(bookingId),
        requestId: null,
        ...ownerFilter,
      }),
    () =>
      Request.findOne({
        _id: new Types.ObjectId(bookingId),
        ...ownerFilter,
      }),
  );
}

export const isTripSettlementBlocked = isTripSettlementBlockedStatus;
