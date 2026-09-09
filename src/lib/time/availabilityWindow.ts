import { Types } from "mongoose";

export const MAX_AVAILABILITY_MINUTES = 8 * 60;

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function normalizeAvailabilityOrigin(
  value: unknown,
): { address: string; lat: number; lng: number } | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  const address = typeof candidate.address === "string" ? candidate.address.trim() : "";
  const lat = Number(candidate.lat);
  const lng = Number(candidate.lng);

  if (!address || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { address, lat, lng };
}

export function isValidAvailabilityId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && Types.ObjectId.isValid(value);
}

export function validateAvailabilityWindow(
  startTime: unknown,
  endTime: unknown,
): string | null {
  const isValidTime = (value: unknown): value is string =>
    typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return "Start and end time are required in HH:MM format.";
  }
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (endMinutes <= startMinutes) return "End time must be after start time.";
  if (endMinutes - startMinutes > MAX_AVAILABILITY_MINUTES) {
    return "Availability cannot exceed 8 hours.";
  }
  return null;
}

/**
 * Checks a candidate shift against a driver's existing same-day shifts.
 * Returns true if [startTime, endTime) overlaps any of the other shifts.
 */
export function shiftsOverlap(
  startTime: string,
  endTime: string,
  others: { startTime: string; endTime: string }[],
): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return others.some(
    (other) =>
      start < timeToMinutes(other.endTime) &&
      end > timeToMinutes(other.startTime),
  );
}

