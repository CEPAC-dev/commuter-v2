import {
  getCairoNowParts,
  getPickupInstant,
} from "../time/cairoTime.ts";

export const MIN_TRIP_SPACING_MINUTES = 30;
const ARRIVAL_WINDOW_HALF_MINUTES = 15;
const MINUTE_MS = 60_000;

export const HOLDING_TRIP_STATUSES = [
  "pending_payment",
  "waiting_list",
  "approved",
  "submitted",
  "matched",
  "confirmed",
  "active",
] as const;

const holdingStatuses = new Set<string>(HOLDING_TRIP_STATUSES);

export interface TripSpacingWindow {
  date: string;
  arrivalTime: string;
  status?: string;
  requestId?: string | null;
}

export interface SpacingConflict {
  date: string;
  arrivalTime: string;
  window: {
    start: string;
    end: string;
  };
}

function getArrivalInterval(trip: TripSpacingWindow) {
  const arrival = getPickupInstant({
    date: trip.date,
    pickupTime: trip.arrivalTime,
  });
  if (!arrival) {
    throw new RangeError(
      `Invalid trip arrival date/time: ${trip.date} ${trip.arrivalTime}`,
    );
  }

  const halfWindowMs = ARRIVAL_WINDOW_HALF_MINUTES * MINUTE_MS;
  const start = arrival.getTime() - halfWindowMs;
  const end = arrival.getTime() + halfWindowMs;
  return { start, end };
}

function formatCairoTime(instant: number): string {
  return getCairoNowParts(new Date(instant)).timeStr;
}

export function findSpacingConflict(
  newTrip: TripSpacingWindow,
  existingTrips: readonly TripSpacingWindow[],
  minGapMinutes = MIN_TRIP_SPACING_MINUTES,
): SpacingConflict | null {
  if (!Number.isFinite(minGapMinutes) || minGapMinutes < 0) {
    throw new RangeError("Minimum trip spacing must be a non-negative number");
  }

  const candidate = getArrivalInterval(newTrip);
  const minGapMs = minGapMinutes * MINUTE_MS;

  for (const existingTrip of existingTrips) {
    if (
      existingTrip.date !== newTrip.date ||
      (existingTrip.status !== undefined &&
        !holdingStatuses.has(existingTrip.status))
    ) {
      continue;
    }

    const existing = getArrivalInterval(existingTrip);
    const conflicts =
      candidate.start < existing.end + minGapMs &&
      existing.start < candidate.end + minGapMs;
    if (!conflicts) continue;

    return {
      date: existingTrip.date,
      arrivalTime: existingTrip.arrivalTime,
      window: {
        start: formatCairoTime(existing.start),
        end: formatCairoTime(existing.end),
      },
    };
  }

  return null;
}

export function hasSpacingConflict(
  newTrip: TripSpacingWindow,
  existingTrips: readonly TripSpacingWindow[],
  minGapMinutes = MIN_TRIP_SPACING_MINUTES,
): boolean {
  return findSpacingConflict(newTrip, existingTrips, minGapMinutes) !== null;
}
