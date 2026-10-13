import { getTripTab, type TripTab } from "./tripTabs.ts";
import { getDisplayStatus } from "./statusDisplay.ts";

export type TripTabRow = {
  id: string;
  requestId: string;
  isStandalone?: boolean;
  status: string;
  paymentStatus?: string;
  parentPaymentStatus?: string | null;
  date: string;
  pickupTime: string;
  parentRequestStatus?: string | null;
  rejectionReason?: string | null;
  hasPastTrip?: boolean;
};

export type TripTabItem<T extends TripTabRow> =
  | { kind: "trip"; date: string; trip: T }
  | { kind: "request"; date: string; requestId: string; trips: T[] };

export type TripTabKey = "all" | "bookings" | "pending" | "upcoming" | "ongoing";

function requestCanPay<T extends TripTabRow>(trip: T, now: Date): boolean {
  return getDisplayStatus({
    request: {
      status: trip.parentRequestStatus ?? trip.status,
      paymentStatus: trip.parentPaymentStatus ?? trip.paymentStatus,
      rejectionReason: trip.rejectionReason,
      hasPastTrip: trip.hasPastTrip,
    },
    trip,
    now,
  }).canPay;
}

export function buildTripTabView<T extends TripTabRow>(
  rows: readonly T[],
  selected: TripTabKey,
  now: Date = new Date(),
): {
  counts: Record<TripTabKey, number>;
  items: TripTabItem<T>[];
  readyToPayCount: number;
} {
  const pendingByRequest = new Map<string, T[]>();
  const pendingStandalone: T[] = [];
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
      if (row.isStandalone) {
        pendingStandalone.push(row);
        continue;
      }
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
  pendingItems.push(
    ...pendingStandalone.map((trip) => ({
      kind: "trip" as const,
      date: trip.date,
      trip,
    })),
  );
  pendingItems.sort((left, right) => left.date.localeCompare(right.date));
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
  const bookingsItems = pendingItems.filter(
    (item): item is Extract<TripTabItem<T>, { kind: "request" }> =>
      item.kind === "request" &&
      item.trips[0].parentPaymentStatus !== "paid",
  );
  const bookedRequestIds = new Set(
    bookingsItems.map((item) => item.requestId),
  );
  const visiblePendingItems = pendingItems.filter(
    (item) => item.kind !== "request" || !bookedRequestIds.has(item.requestId),
  );
  bookingsItems.sort((left, right) => {
    if (left.kind !== "request" || right.kind !== "request") return 0;
    const leftReady = left.trips.some((trip) => requestCanPay(trip, now));
    const rightReady = right.trips.some((trip) => requestCanPay(trip, now));
    return Number(rightReady) - Number(leftReady) || left.date.localeCompare(right.date);
  });
  const allPendingTrips = [
    ...Array.from(pendingByRequest)
      .filter(([requestId]) => !bookedRequestIds.has(requestId))
      .flatMap(([, trips]) => trips),
    ...pendingStandalone,
  ].map((trip) => ({
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
    bookings: bookingsItems.length,
  };
  const items =
    selected === "all"
      ? allItems
      : selected === "bookings"
        ? bookingsItems
      : selected === "pending"
        ? visiblePendingItems
        : selected === "upcoming"
          ? upcomingItems
          : ongoingItems;

  return {
    counts: { ...counts, pending: visiblePendingItems.length },
    items,
    readyToPayCount: bookingsItems.filter(
      (item) =>
        item.kind === "request" &&
        item.trips.some((trip) => requestCanPay(trip, now)),
    ).length,
  };
}