import { hasPastPickup, isPastPickup } from "./time/cairoTime.ts";

type TripLike = {
  status?: string | null;
  date?: string | null;
  pickupTime?: string | null;
};

type RequestLike = {
  status?: string | null;
  hasPastTrip?: boolean;
  trips?: readonly TripLike[];
};

export type TripTab = "pending" | "upcoming" | "ongoing" | "history";

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

  if (
    ["completed", "cancelled", "refunded", "time_out"].includes(childStatus ?? "") ||
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