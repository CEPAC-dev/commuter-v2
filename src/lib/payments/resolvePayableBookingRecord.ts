import { hasPastTrip, type CairoNowParts } from "../admin/waitingList.ts";

interface PayableRecord {
  paymentStatus: string;
  status: string;
}

type TripRecord = PayableRecord & {
  priceEgp: number;
  requestId?: unknown;
};

type RequestRecord = PayableRecord & {
  amountEgp: number;
};

export function isStandaloneTripRecord(
  trip: { requestId?: unknown } | null,
): trip is { requestId?: undefined | null } {
  return Boolean(trip && (trip.requestId == null || trip.requestId === ""));
}

export function isStandaloneTripPayable(booking: {
  status: string;
  paymentStatus: string;
}): boolean {
  return (
    (booking.status === "pending_payment" || booking.status === "approved") &&
    (booking.paymentStatus === "pending" || booking.paymentStatus === "failed")
  );
}

export function isApprovedTripPickupPast(
  booking: { status: string; date: string; pickupTime: string },
  now: CairoNowParts,
): boolean {
  return (
    booking.status === "approved" &&
    hasPastTrip([{ date: booking.date, pickupTime: booking.pickupTime }], now)
  );
}

export async function resolvePayableBookingWith<
  TTrip extends TripRecord,
  TRequest extends RequestRecord,
>(
  findTrip: () => Promise<TTrip | null>,
  findRequest: () => Promise<TRequest | null>,
): Promise<
  | {
      kind: "trip";
      doc: TTrip;
      amountEgp: number;
      paymentStatus: string;
      status: string;
    }
  | {
      kind: "request";
      doc: TRequest;
      amountEgp: number;
      paymentStatus: string;
      status: string;
    }
  | null
> {
  const trip = await findTrip();
  if (isStandaloneTripRecord(trip)) {
    return {
      kind: "trip",
      doc: trip,
      amountEgp: trip.priceEgp,
      paymentStatus: trip.paymentStatus,
      status: trip.status,
    };
  }

  const request = await findRequest();
  if (!request) return null;
  return {
    kind: "request",
    doc: request,
    amountEgp: request.amountEgp,
    paymentStatus: request.paymentStatus,
    status: request.status,
  };
}
