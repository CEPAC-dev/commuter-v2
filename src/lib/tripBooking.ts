export const MAX_BOOKING_DATES = 7;
export const MAX_PENDING_UNPAID_TRIPS = 10;

export type TripBatchPayloadError =
  | "TOO_MANY_DATES"
  | "MULTIPLE_CYCLES_NOT_SUPPORTED";

export function getTripBatchPayloadError(
  dateCount: number,
  tripCount: number,
): TripBatchPayloadError | null {
  if (dateCount > MAX_BOOKING_DATES) return "TOO_MANY_DATES";
  if (tripCount > 1) return "MULTIPLE_CYCLES_NOT_SUPPORTED";
  return null;
}

export function hasDuplicateDates(dates: readonly string[]): boolean {
  return new Set(dates).size !== dates.length;
}

export function getTripBatchDateValidationError(
  dates: readonly string[],
  allowedDates: readonly string[],
):
  | { code: "TOO_MANY_DATES" }
  | { code: "DUPLICATE_DATES" }
  | { code: "INVALID_DATE"; date: string }
  | null {
  if (dates.length > MAX_BOOKING_DATES) return { code: "TOO_MANY_DATES" };
  if (hasDuplicateDates(dates)) return { code: "DUPLICATE_DATES" };
  const allowed = new Set(allowedDates);
  const invalidDate = dates.find(
    (date) =>
      !/^\d{4}-\d{2}-\d{2}$/.test(date) || !allowed.has(date),
  );
  return invalidDate ? { code: "INVALID_DATE", date: invalidDate } : null;
}

export function buildTripBatchResponse(input: {
  batchId: string;
  candidates: readonly { id: string; date: string; priceEgp: number }[];
  waitlist: boolean;
}) {
  const trips = input.candidates.map((candidate) => ({
    id: candidate.id,
    date: candidate.date,
    priceEgp: candidate.priceEgp,
    status: input.waitlist ? "waiting_list" : "pending_payment",
    paymentStatus: "pending",
  }));
  const totalEgp = input.candidates.reduce(
    (total, candidate) => total + candidate.priceEgp,
    0,
  );
  const representativeTripId = input.candidates[0]?.id;

  return {
    batchId: input.batchId,
    trips,
    totalEgp,
    waitlist: input.waitlist,
    ...(input.candidates.length === 1 && representativeTripId
      ? {
          tripId: representativeTripId,
          bookingId: representativeTripId,
          tripIds: [representativeTripId],
          amountEgp: totalEgp,
          waitingList: input.waitlist,
        }
      : {}),
  };
}

export function getInitialTripBookingState(waitlist: boolean): {
  paymentStatus: "pending";
  status: "waiting_list" | "pending_payment";
} {
  return {
    paymentStatus: "pending",
    status: waitlist ? "waiting_list" : "pending_payment",
  };
}
