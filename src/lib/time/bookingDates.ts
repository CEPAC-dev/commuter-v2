import { addDays, format, startOfDay } from "date-fns";

/** Earliest selectable booking date: tomorrow, or day-after-tomorrow if now >= 20:00 local. */
export function earliestBookingDate(now: Date = new Date()): string {
  const offset = now.getHours() >= 20 ? 2 : 1;
  return format(addDays(startOfDay(now), offset), "yyyy-MM-dd");
}

/** 7 selectable dates starting from earliestBookingDate(now). */
export function bookingWindow(now: Date = new Date()): string[] {
  const earliest = earliestBookingDate(now);
  const start = new Date(`${earliest}T00:00:00`);
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(start, i), "yyyy-MM-dd"),
  );
}

/** Whether `date` ("YYYY-MM-DD") falls inside the current 7-day booking window. */
export function isDateInWindow(date: string, now: Date = new Date()): boolean {
  return bookingWindow(now).includes(date);
}
