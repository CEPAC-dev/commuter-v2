type PassengerRecord = Record<string, unknown>;

function isPassengerRecord(value: unknown): value is PassengerRecord {
  return Boolean(value) && typeof value === "object";
}

function passengerCount(entries: unknown): number {
  if (!Array.isArray(entries)) return 0;
  return entries.reduce((total, entry) => {
    if (!isPassengerRecord(entry)) return total;
    const count = Number(entry.numberOfPassengers ?? 1);
    return total + (Number.isFinite(count) && count > 0 ? count : 1);
  }, 0);
}

export function normalizeSharedRidePassengers(
  ride: Record<string, unknown>,
): PassengerRecord[] {
  const directPassengers = Array.isArray(ride.passengers)
    ? ride.passengers.filter(isPassengerRecord)
    : [];

  if (ride.rideType !== "shared") return directPassengers;

  const passengersByTripId = new Map<string, PassengerRecord>();
  for (const passenger of directPassengers) {
    if (!passenger.tripId) continue;
    passengersByTripId.set(String(passenger.tripId), { ...passenger });
  }

  for (const [stopIndex, stop] of (
    Array.isArray(ride.route) ? ride.route : []
  ).entries()) {
    if (!isPassengerRecord(stop)) continue;
    const stationIndex = stopIndex + 1;

    for (const [direction, entries] of [
      ["pickupOrder", stop.boarding],
      ["dropoffOrder", stop.alighting],
    ] as const) {
      if (!Array.isArray(entries)) continue;

      for (const entry of entries) {
        if (!isPassengerRecord(entry) || !entry.tripId) continue;
        const tripId = String(entry.tripId);
        const existing = passengersByTripId.get(tripId) ?? {};
        passengersByTripId.set(tripId, {
          ...entry,
          ...existing,
          [direction]: stationIndex,
        });
      }
    }
  }

  return [...passengersByTripId.values()].sort(
    (left, right) =>
      Number(left.pickupOrder ?? 0) - Number(right.pickupOrder ?? 0),
  );
}

export function getSharedRouteStopCounts(stop: Record<string, unknown>) {
  const boarding = passengerCount(stop.boarding);
  const alighting = passengerCount(stop.alighting);
  const legacyBoarding = Number(stop.boarding ?? stop.boardingNumber ?? 0);
  const legacyAlighting = Number(stop.alighting ?? stop.alightingNumber ?? 0);

  return {
    boarding:
      boarding ||
      (Number.isFinite(legacyBoarding) ? legacyBoarding : 0),
    alighting:
      alighting ||
      (Number.isFinite(legacyAlighting) ? legacyAlighting : 0),
  };
}