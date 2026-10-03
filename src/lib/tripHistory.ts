import { getDisplayStatus } from "./statusDisplay.ts";
import { getTripTab } from "./tripTabs.ts";

export type TripHistoryFilter =
  | "all"
  | "completed"
  | "cancelled"
  | "refunded"
  | "rejected"
  | "expired";

export type TripHistoryCategory = Exclude<TripHistoryFilter, "all">;

export type TripHistoryRequest = {
  status?: string | null;
  paymentStatus?: string | null;
  rejectionReason?: string | null;
  hasPastTrip?: boolean;
};

export type TripHistoryTrip = {
  status?: string | null;
  paymentStatus?: string | null;
  date?: string | null;
  pickupTime?: string | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  cancellation?: { refundStatus?: string | null; reason?: string | null } | null;
};

export function getTripHistoryCategory(
  request: TripHistoryRequest,
  trip: TripHistoryTrip,
  now: Date = new Date(),
): TripHistoryCategory | null {
  if (request.status === "rejected" || trip.cancelledBy === "admin_rejected") {
    return "rejected";
  }
  if (trip.status === "completed") return "completed";
  if (trip.status === "cancelled") return "cancelled";
  if (trip.status === "refunded") return "refunded";
  if (request.status === "time_out" || trip.status === "time_out") return "expired";

  return getDisplayStatus({ request, trip, now }).key === "status.expired"
    ? "expired"
    : null;
}

export function matchesTripHistoryFilter(
  filter: TripHistoryFilter,
  request: TripHistoryRequest,
  trips: readonly TripHistoryTrip[],
  now: Date = new Date(),
): boolean {
  const isHistory = trips.some(
    (trip) => getTripTab({ request, trip, now }) === "history",
  );
  if (!isHistory) return false;
  if (filter === "all") return true;
  return trips.some(
    (trip) => getTripHistoryCategory(request, trip, now) === filter,
  );
}