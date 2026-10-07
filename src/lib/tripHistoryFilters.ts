import { comparePickup } from "./time/cairoTime.ts";
import type { TripHistoryFilter } from "./tripHistory.ts";

export type HistoryParamsError =
  | "invalid_trip_number"
  | "invalid_date"
  | "from_after_to"
  | null;

export type ParsedHistoryParams = {
  q: string;
  tripNumber: number | null;
  from: string;
  to: string;
  status: TripHistoryFilter;
  page: number;
  error: HistoryParamsError;
};

const STATUS_FILTERS: readonly TripHistoryFilter[] = [
  "all",
  "completed",
  "cancelled",
  "refunded",
  "rejected",
  "expired",
];

export function normalizeTripNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^#?\s*\d+$/.test(trimmed)) return null;
  const tripNumber = Number(trimmed.replace(/^#\s*/, ""));
  return Number.isSafeInteger(tripNumber) && tripNumber > 0 ? tripNumber : null;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function readString(params: Record<string, unknown>, key: string): string {
  return typeof params[key] === "string" ? (params[key] as string).trim() : "";
}

export function parseHistoryParams(
  params: Record<string, unknown>,
): ParsedHistoryParams {
  const q = readString(params, "q");
  const from = readString(params, "from");
  const to = readString(params, "to");
  const rawStatus = readString(params, "status");
  const rawPage = readString(params, "page");
  const tripNumber = q ? normalizeTripNumber(q) : null;
  const pageNumber = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;

  let error: HistoryParamsError = null;
  if (q && tripNumber === null) error = "invalid_trip_number";
  else if ((from && !isValidDate(from)) || (to && !isValidDate(to))) error = "invalid_date";
  else if (from && to && from > to) error = "from_after_to";

  return {
    q,
    tripNumber,
    from: from && isValidDate(from) ? from : "",
    to: to && isValidDate(to) ? to : "",
    status: STATUS_FILTERS.includes(rawStatus as TripHistoryFilter)
      ? (rawStatus as TripHistoryFilter)
      : "all",
    page: Number.isSafeInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1,
    error,
  };
}

export type HistoryDateRange = { from?: string; to?: string };
export type PickupDate = { date: string; pickupTime: string };

export function pickupFallsInDateRange(
  trip: PickupDate,
  range: HistoryDateRange,
): boolean {
  if (range.from && comparePickup(trip, { dateStr: range.from, timeStr: "00:00" }) < 0) {
    return false;
  }
  if (range.to && comparePickup(trip, { dateStr: range.to, timeStr: "23:59" }) > 0) {
    return false;
  }
  return true;
}

export function requestGroupMatchesDateRange(
  trips: readonly PickupDate[],
  range: HistoryDateRange,
): boolean {
  return trips.some((trip) => pickupFallsInDateRange(trip, range));
}

export function buildHistoryTripMatch(
  userId: string,
  filters: { tripNumber?: number | null; from?: string; to?: string },
): Record<string, unknown> {
  const match: Record<string, unknown> = { userId };
  if (filters.tripNumber != null) match.tripNumber = filters.tripNumber;
  if (filters.from || filters.to) {
    match.date = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  }
  return match;
}