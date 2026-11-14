export const BOOKING_WINDOW_DAYS = 7;
export const BOOKING_CUTOFF_LOCAL_TIME = "19:00";

const DEFAULT_TIME_ZONE = "Africa/Cairo";

function getLocalDateTimeParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
  };
}

/** Earliest selectable date: tomorrow, or the day after at/after 19:00 in the region. */
export function earliestBookingDate(
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): string {
  const { date, hour } = getLocalDateTimeParts(now, timeZone);
  const [year, month, day] = date.split("-").map(Number);
  const offset = hour >= 19 ? 2 : 1;
  return new Date(Date.UTC(year, month - 1, day + offset))
    .toISOString()
    .slice(0, 10);
}

/** Seven selectable calendar dates beginning at earliestBookingDate. */
export function bookingWindow(
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): string[] {
  const [year, month, day] = earliestBookingDate(now, timeZone)
    .split("-")
    .map(Number);
  return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, index) =>
    new Date(Date.UTC(year, month - 1, day + index))
      .toISOString()
      .slice(0, 10),
  );
}

/** Whether `date` ("YYYY-MM-DD") falls inside the current regional booking window. */
export function isDateInWindow(
  date: string,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): boolean {
  return bookingWindow(now, timeZone).includes(date);
}
