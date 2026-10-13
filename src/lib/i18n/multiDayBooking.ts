import type { Locale } from "./config";

type MultiDayBookingCountKey =
  | "my_trips.multi_day_booking"
  | "my_trips.multi_day_booking_one"
  | "my_trips.multi_day_booking_dual"
  | "my_trips.multi_day_booking_few"
  | "my_trips.multi_day_booking_many";

export function multiDayBookingCountKey(
  locale: Locale,
  count: number,
): MultiDayBookingCountKey {
  if (locale !== "ar") return "my_trips.multi_day_booking";
  if (count === 1) return "my_trips.multi_day_booking_one";
  if (count === 2) return "my_trips.multi_day_booking_dual";
  if (count >= 3 && count <= 10) return "my_trips.multi_day_booking_few";
  if (count >= 11) return "my_trips.multi_day_booking_many";
  return "my_trips.multi_day_booking";
}
