import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { getInitialTripBookingState, getMultiTripBookingError } = await import(
  "../src/lib/tripBooking.ts"
);

test("rejects a multi-date booking with the explicit API error code", () => {
  assert.equal(
    getMultiTripBookingError(2, 1),
    "MULTIPLE_DATES_NOT_SUPPORTED",
  );
});

test("rejects a multi-trip booking with the explicit API error code", () => {
  assert.equal(
    getMultiTripBookingError(1, 2),
    "MULTIPLE_TRIPS_NOT_SUPPORTED",
  );
  assert.equal(getMultiTripBookingError(1, 1), null);
});

test("chooses the standalone Trip's initial status from the waitlist flag", () => {
  assert.deepEqual(getInitialTripBookingState(true), {
    paymentStatus: "pending",
    status: "waiting_list",
  });
  assert.deepEqual(getInitialTripBookingState(false), {
    paymentStatus: "pending",
    status: "pending_payment",
  });
});

test("the POST persistence path inserts only standalone Trip documents", async () => {
  const route = await readFile(
    new URL("../src/app/api/trips/route.ts", import.meta.url),
    "utf8",
  );
  const tripDocumentBuilder = route.slice(
    route.indexOf("const tripDocuments"),
    route.indexOf("const db = mongoose.connection.db"),
  );

  assert.match(route, /getMultiTripBookingError/);
  assert.match(route, /Trip\.insertMany\(tripDocuments/);
  assert.match(route, /TRIP_SPACING_CONFLICT[\s\S]*?status: 409/);
  assert.match(route, /tripId: representativeTripId/);
  assert.match(route, /bookingId: representativeTripId/);
  assert.doesNotMatch(route, /Request\.create\s*\(/);
  assert.doesNotMatch(tripDocumentBuilder, /\brequestId\b/);
});

test("localizes the one-trip API errors in English and Arabic", async () => {
  const [english, arabic] = await Promise.all([
    readFile(new URL("../src/lib/i18n/messages/en.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/i18n/messages/ar.ts", import.meta.url), "utf8"),
  ]);
  for (const code of [
    "MULTIPLE_DATES_NOT_SUPPORTED",
    "MULTIPLE_TRIPS_NOT_SUPPORTED",
  ]) {
    assert.match(english, new RegExp(`errors\\.${code}`));
    assert.match(arabic, new RegExp(`errors\\.${code}`));
  }
});
