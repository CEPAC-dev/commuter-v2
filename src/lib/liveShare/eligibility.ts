export interface ShareTripState {
  userId: unknown;
  driverId?: unknown;
  status?: string | null;
  updatedAt?: Date | string | null;
}

export interface ShareRideState {
  status?: string | null;
  updatedAt?: Date | string | null;
}

const SHAREABLE_STATUSES = new Set(["confirmed", "active"]);
const ENDED_TRIP_STATUSES = new Set([
  "completed",
  "cancelled",
  "refunded",
  "time_out",
  "nomatch",
]);
const ENDED_RIDE_STATUSES = new Set(["completed", "cancelled"]);

export function canShare(
  trip: ShareTripState,
  ownerId: string,
  ride?: ShareRideState | null,
): boolean {
  return (
    String(trip.userId) === ownerId &&
    Boolean(trip.driverId) &&
    (SHAREABLE_STATUSES.has(trip.status ?? "") ||
      SHAREABLE_STATUSES.has(ride?.status ?? ""))
  );
}

export function isEnded(
  trip: Pick<ShareTripState, "status">,
  ride?: ShareRideState | null,
): boolean {
  return (
    ENDED_TRIP_STATUSES.has(trip.status ?? "") ||
    ENDED_RIDE_STATUSES.has(ride?.status ?? "")
  );
}

export function detectedTripEndAt(
  trip: Pick<ShareTripState, "status" | "updatedAt">,
  ride: Pick<ShareRideState, "status" | "updatedAt"> | null | undefined,
  fallback: Date,
): Date {
  const timestamps: number[] = [];
  if (ENDED_TRIP_STATUSES.has(trip.status ?? "") && trip.updatedAt) {
    const value = new Date(trip.updatedAt).getTime();
    if (Number.isFinite(value)) timestamps.push(value);
  }
  if (ENDED_RIDE_STATUSES.has(ride?.status ?? "") && ride?.updatedAt) {
    const value = new Date(ride.updatedAt).getTime();
    if (Number.isFinite(value)) timestamps.push(value);
  }
  return timestamps.length ? new Date(Math.min(...timestamps)) : fallback;
}
