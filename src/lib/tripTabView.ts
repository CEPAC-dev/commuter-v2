import { getTripTab, type TripTab } from "./tripTabs.ts";

export type TripTabRow = {
  id: string;
  requestId: string;
  status: string;
  date: string;
  pickupTime: string;
  parentRequestStatus?: string | null;
  hasPastTrip?: boolean;
};

export type TripTabItem<T extends TripTabRow> =
  | { kind: "trip"; date: string; trip: T }
  | { kind: "request"; date: string; requestId: string; trips: T[] };

export type TripTabKey = "all" | "pending" | "upcoming" | "ongoing";

export function buildTripTabView<T extends TripTabRow>(
  rows: readonly T[],
  selected: TripTabKey,
  now: Date = new Date(),
): {
  counts: Record<TripTabKey, number>;
  items: TripTabItem<T>[];
} {
  const pendingByRequest = new Map<string, T[]>();
  const upcoming: T[] = [];
  const ongoing: T[] = [];

  for (const row of rows) {
    const tab: TripTab = getTripTab({
      request: {
        status: row.parentRequestStatus ?? row.status,
        hasPastTrip: row.hasPastTrip,
      },
      trip: row,
      now,
    });
    if (tab === "pending") {
      const requestTrips = pendingByRequest.get(row.requestId) ?? [];
      requestTrips.push(row);
      pendingByRequest.set(row.requestId, requestTrips);
    } else if (tab === "upcoming") {
      upcoming.push(row);
    } else if (tab === "ongoing") {
      ongoing.push(row);
    }
  }

  const pendingItems: TripTabItem<T>[] = Array.from(
    pendingByRequest,
    ([requestId, trips]) => ({
      kind: "request" as const,
      requestId,
      date: trips[0].date,
      trips,
    }),
  );
  const upcomingItems = upcoming.map((trip) => ({
    kind: "trip" as const,
    date: trip.date,
    trip,
  }));
  const ongoingItems = ongoing.map((trip) => ({
    kind: "trip" as const,
    date: trip.date,
    trip,
  }));
  const allPendingTrips = Array.from(pendingByRequest.values()).flat().map((trip) => ({
    kind: "trip" as const,
    date: trip.date,
    trip,
  }));
  const allItems = [...allPendingTrips, ...upcomingItems, ...ongoingItems].sort(
    (left, right) => left.date.localeCompare(right.date),
  );

  const counts = {
    pending: pendingItems.length,
    upcoming: upcoming.length,
    ongoing: ongoing.length,
    all: allItems.length,
  };
  const items =
    selected === "all"
      ? allItems
      : selected === "pending"
        ? pendingItems
        : selected === "upcoming"
          ? upcomingItems
          : ongoingItems;

  return { counts, items };
}