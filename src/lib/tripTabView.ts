import {
  getTripTab,
  type PassengerTabKey,
  type TripTab,
} from "./tripTabs.ts";
import { getDisplayStatus } from "./statusDisplay.ts";
export type { PassengerTabKey } from "./tripTabs.ts";

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

export type TripTabKey = PassengerTabKey;

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
  payablePendingCount: number;
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
      if (
        !row.isStandalone &&
        row.parentPaymentStatus === "paid"
      ) {
        continue;
      }
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
  const itemCanPay = (item: TripTabItem<T>) =>
    item.kind === "request"
      ? item.trips.some((trip) => requestCanPay(trip, now))
      : getDisplayStatus({
          request: {
            status: item.trip.parentRequestStatus ?? item.trip.status,
            paymentStatus:
              item.trip.parentPaymentStatus ?? item.trip.paymentStatus,
            rejectionReason: item.trip.rejectionReason,
            hasPastTrip: item.trip.hasPastTrip,
          },
          trip: item.trip,
          now,
        }).canPay;
  pendingItems.sort(
    (left, right) =>
      Number(itemCanPay(right)) - Number(itemCanPay(left)) ||
      left.date.localeCompare(right.date),
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
  const unpaidRequestIds = new Set(
    pendingItems.flatMap((item) =>
      item.kind === "request" ? [item.requestId] : [],
    ),
  );
  const pendingRequestItems = pendingItems.filter(
    (item): item is Extract<TripTabItem<T>, { kind: "request" }> =>
      item.kind === "request" &&
      item.trips.length > 1 &&
      item.trips[0].parentPaymentStatus !== "paid",
  );
  const pendingSingleRequestItems = pendingItems.flatMap((item) =>
    item.kind === "request" && item.trips.length === 1
      ? [
          {
            kind: "trip" as const,
            date: item.trips[0].date,
            trip: item.trips[0],
          },
        ]
      : [],
  );
  const combinedPendingItems = [
    ...pendingRequestItems,
    ...pendingItems.filter((item) => item.kind === "trip"),
    ...pendingSingleRequestItems,
  ].sort(
    (left, right) =>
      Number(itemCanPay(right)) - Number(itemCanPay(left)) ||
      left.date.localeCompare(right.date),
  );
  const allPendingTrips = [
    ...Array.from(pendingByRequest)
      .filter(([requestId]) => !unpaidRequestIds.has(requestId))
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
  };
  const items =
    selected === "all"
      ? allItems
      : selected === "pending"
        ? combinedPendingItems
        : selected === "upcoming"
          ? upcomingItems
          : ongoingItems;

  return {
    counts: { ...counts, pending: combinedPendingItems.length },
    items,
    payablePendingCount: combinedPendingItems.filter(itemCanPay).length,
  };
}