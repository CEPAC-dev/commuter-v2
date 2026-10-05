export function getCairoNowParts(nowDate: Date = new Date()): {
  dateStr: string;
  timeStr: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(nowDate);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  const hour = map.hour === "24" ? "00" : map.hour;
  return {
    dateStr: `${map.year}-${map.month}-${map.day}`,
    timeStr: `${hour}:${map.minute}`,
  };
}

export type CairoNowParts = { dateStr: string; timeStr: string };

export function comparePickup(
  left: { date: string; pickupTime: string },
  right:
    | { date: string; pickupTime: string }
    | CairoNowParts
    | Date,
): number {
  const rightParts =
    right instanceof Date
      ? getCairoNowParts(right)
      : "dateStr" in right
        ? right
        : { dateStr: right.date, timeStr: right.pickupTime };
  const leftKey = `${left.date}T${left.pickupTime}`;
  const rightKey = `${rightParts.dateStr}T${rightParts.timeStr}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

export function getMinutesUntilPickup(
  trip: { date: string; pickupTime: string },
  now: Date = new Date(),
): number {
  const pickup = getPickupInstant(trip);
  return pickup ? Math.round((pickup.getTime() - now.getTime()) / 60_000) : Number.NaN;
}

export function getPickupInstant(trip: {
  date: string;
  pickupTime: string;
}): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trip.date) || !/^\d{2}:\d{2}$/.test(trip.pickupTime)) {
    return null;
  }

  const dateStart = Date.parse(`${trip.date}T00:00:00.000Z`);
  const [hour, minute] = trip.pickupTime.split(":").map(Number);
  if (
    !Number.isFinite(dateStart) ||
    new Date(dateStart).toISOString().slice(0, 10) !== trip.date ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  const targetWallTime = Date.parse(`${trip.date}T${trip.pickupTime}:00Z`);
  if (!Number.isFinite(targetWallTime)) return null;

  let instant = targetWallTime;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const local = getCairoNowParts(new Date(instant));
    const representedWallTime = Date.parse(`${local.dateStr}T${local.timeStr}:00Z`);
    instant += targetWallTime - representedWallTime;
  }
  return Number.isFinite(instant) ? new Date(instant) : null;
}

export function isPastPickup(
  trip: { date?: string | null; pickupTime?: string | null },
  now: Date | CairoNowParts,
): boolean {
  if (!trip.date || !trip.pickupTime) return false;
  return comparePickup(trip as { date: string; pickupTime: string }, now) < 0;
}

export function hasPastPickup(
  trips: readonly { date?: string | null; pickupTime?: string | null }[],
  now: Date | CairoNowParts,
): boolean {
  return trips.some((trip) => isPastPickup(trip, now));
}