import { getTripTab } from "./tripTabs.ts";
import { comparePickup } from "./time/cairoTime.ts";
import type { TripListRow } from "@/types/booking";

export function getNextTrip({
  trips,
  now = new Date(),
}: {
  trips: readonly TripListRow[];
  now?: Date;
}): TripListRow | null {
  const active = trips.filter((trip) =>
    getTripTab({
      request: {
        status: trip.parentRequestStatus ?? trip.status,
        hasPastTrip: trip.hasPastTrip,
      },
      trip,
      now,
    }) === "ongoing",
  );
  if (active.length > 0) {
    return [...active].sort((left, right) => comparePickup(left, right))[0] ?? null;
  }

  return (
    trips
      .filter(
        (trip) =>
          getTripTab({
            request: {
              status: trip.parentRequestStatus ?? trip.status,
              hasPastTrip: trip.hasPastTrip,
            },
            trip,
            now,
          }) === "upcoming" && comparePickup(trip, now) > 0,
      )
      .sort((left, right) => comparePickup(left, right))[0] ?? null
  );
}