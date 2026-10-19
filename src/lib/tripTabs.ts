import { hasPastPickup, isPastPickup } from "./time/cairoTime.ts";

type TripLike = {
  isStandalone?: boolean;
  status?: string | null;
  paymentStatus?: string | null;
  date?: string | null;
  pickupTime?: string | null;
};

type RequestLike = {
  status?: string | null;
  hasPastTrip?: boolean;
  trips?: readonly TripLike[];
};

export type TripTab = "pending" | "upcoming" | "ongoing" | "history";
export type PassengerTabKey = "all" | "pending" | "upcoming" | "ongoing";

export function normalizePassengerTabKey(value: string): PassengerTabKey {
  switch (value) {
    case "bookings":
    case "pending":
      return "pending";
    case "upcoming":
    case "ongoing":
      return value;
    default:
      return "all";
  }
}

function requestHasPastPickup(request: RequestLike, trip: TripLike, now: Date): boolean {
  if (request.hasPastTrip === true) return true;
  if (request.trips?.length) {
    return hasPastPickup(request.trips, now);
  }
  return isPastPickup(trip, now);
}

export function getTripTab({
  request,
  trip,
  now = new Date(),
}: {
  request?: RequestLike | null;
  trip: TripLike;
  now?: Date;
}): TripTab {
  const parent = request ?? {};
  const childStatus = trip.status;
  const requestStatus = parent.status;
  const pastPickup = isPastPickup(trip, now);

  if (trip.isStandalone) {
    if (["pending_payment", "waiting_list"].includes(childStatus ?? "")) {
      return "pending";
    }
    if (childStatus === "approved") {
      if (
        trip.paymentStatus === undefined ||
        trip.paymentStatus === "pending" ||
        trip.paymentStatus === "failed"
      ) {
        return "pending";
      }
      return pastPickup ? "history" : "upcoming";
    }
    if (childStatus === "active") return "ongoing";
    if (
      ["submitted", "matched", "confirmed", "nomatch"].includes(
        childStatus ?? "",
      )
    ) {
      return pastPickup ? "history" : "upcoming";
    }
    return "history";
  }

  if (
    ["completed", "no_show", "cancelled", "refunded", "time_out"].includes(childStatus ?? "") ||
    childStatus === "rejected" || requestStatus === "rejected" || requestStatus === "time_out"
  ) {
    return "history";
  }

  if (["waiting_list", "approved", "pending_payment"].includes(requestStatus ?? "")) {
    return requestHasPastPickup(parent, trip, now) ? "history" : "pending";
  }

  if (childStatus === "active") return "ongoing";

  if (["submitted", "matched", "confirmed", "nomatch"].includes(childStatus ?? "")) {
    return pastPickup ? "history" : "upcoming";
  }

  return "history";
}