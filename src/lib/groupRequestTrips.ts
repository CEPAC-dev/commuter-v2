export interface RequestTripGroupable {
  id: string;
  requestId: string;
  isStandalone?: boolean;
  date: string;
  cycleIndex?: number;
  status?: string;
  parentPaymentStatus?: string;
}

/** Groups legacy Request-backed trips; standalone Trips remain individual rows. */
export type RequestTripGroup<T extends RequestTripGroupable> =
  | { kind: "single"; trip: T }
  | { kind: "group"; requestId: string; trips: T[] };

/** Legacy Request grouping helper. Standalone Trips are never grouped. */
export function groupTripsByRequest<T extends RequestTripGroupable>(
  trips: readonly T[],
): RequestTripGroup<T>[] {
  const tripsByRequest = new Map<string, T[]>();
  const standaloneTrips: T[] = [];
  for (const trip of trips) {
    if (
      trip.isStandalone ||
      trip.status === "cancelled" ||
      trip.parentPaymentStatus === "paid"
    ) {
      standaloneTrips.push(trip);
      continue;
    }
    const requestTrips = tripsByRequest.get(trip.requestId) ?? [];
    requestTrips.push(trip);
    tripsByRequest.set(trip.requestId, requestTrips);
  }

  const requestGroups = Array.from(tripsByRequest, ([requestId, requestTrips]) => {
    const orderedTrips = [...requestTrips].sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        (left.cycleIndex ?? 0) - (right.cycleIndex ?? 0),
    );
    return { kind: "group", requestId, trips: orderedTrips } as const;
  });
  const standaloneRows = standaloneTrips.map((trip) => ({
    kind: "single" as const,
    trip,
  }));

  return [...requestGroups, ...standaloneRows];
}