export type MultiTripBookingError =
  | "MULTIPLE_DATES_NOT_SUPPORTED"
  | "MULTIPLE_TRIPS_NOT_SUPPORTED";

export function getMultiTripBookingError(
  dateCount: number,
  tripCount: number,
): MultiTripBookingError | null {
  if (dateCount > 1) return "MULTIPLE_DATES_NOT_SUPPORTED";
  if (tripCount > 1) return "MULTIPLE_TRIPS_NOT_SUPPORTED";
  return null;
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
