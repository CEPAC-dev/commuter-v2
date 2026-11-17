import test from "node:test";
import assert from "node:assert/strict";
import {
  BOOKING_WINDOW_DAYS,
  bookingWindow,
  earliestBookingDate,
} from "../src/lib/time/bookingDates.ts";

test("booking window uses tomorrow before 19:00 in the region timezone", () => {
  const beforeCutoff = new Date("2026-11-14T16:59:00.000Z");

  assert.equal(earliestBookingDate(beforeCutoff, "Africa/Cairo"), "2026-11-15");
  assert.deepEqual(bookingWindow(beforeCutoff, "Africa/Cairo"), [
    "2026-11-15",
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
    "2026-11-21",
  ]);
});

test("booking window starts the day after tomorrow at/after 19:00 region time", () => {
  const atCutoff = new Date("2026-11-14T17:00:00.000Z");
  const dates = bookingWindow(atCutoff, "Africa/Cairo");

  assert.equal(earliestBookingDate(atCutoff, "Africa/Cairo"), "2026-11-16");
  assert.equal(dates.length, BOOKING_WINDOW_DAYS);
  assert.equal(dates[0], "2026-11-16");
  assert.equal(dates[6], "2026-11-22");
});
