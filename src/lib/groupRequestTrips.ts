export interface RequestTripGroupable {
  id: string;
  requestId: string;
  date: string;
  cycleIndex?: number;
}

export type RequestTripGroup<T extends RequestTripGroupable> =
  | { kind: "single"; trip: T }
  | { kind: "group"; requestId: string; trips: T[] };

export function groupTripsByRequest<T extends RequestTripGroupable>(
  trips: readonly T[],
): RequestTripGroup<T>[] {
  const tripsByRequest = new Map<string, T[]>();
  for (const trip of trips) {
    const requestTrips = tripsByRequest.get(trip.requestId) ?? [];
    requestTrips.push(trip);
    tripsByRequest.set(trip.requestId, requestTrips);
  }

  return Array.from(tripsByRequest, ([requestId, requestTrips]) => {
    const orderedTrips = [...requestTrips].sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        (left.cycleIndex ?? 0) - (right.cycleIndex ?? 0),
    );
    if (orderedTrips.length === 1) {
      return { kind: "single", trip: orderedTrips[0] } as const;
    }
    return { kind: "group", requestId, trips: orderedTrips } as const;
  });
}