import test from "node:test";
import assert from "node:assert/strict";

const {
  buildTripBatchResponse,
  getInitialTripBookingState,
  getTripBatchDateValidationError,
  getTripBatchPayloadError,
  MAX_BOOKING_DATES,
} = await import("../src/lib/tripBooking.ts");
const {
  buildWaitingListCreatedTripBatchAdminNotifications,
  waitingListTripBatchDedupeKey,
} = await import("../src/lib/admin/waitingList.ts");

const validDates = Array.from(
  { length: MAX_BOOKING_DATES },
  (_, index) => `2028-01-${String(index + 1).padStart(2, "0")}`,
);

test("accepts one through seven unique dates within the booking window", () => {
  assert.equal(getTripBatchDateValidationError(validDates.slice(0, 1), validDates), null);
  assert.equal(getTripBatchDateValidationError(validDates, validDates), null);
});

test("rejects duplicate, invalid, out-of-window, and over-limit dates", () => {
  assert.deepEqual(
    getTripBatchDateValidationError([validDates[0], validDates[0]], validDates),
    { code: "DUPLICATE_DATES" },
  );
  assert.deepEqual(
    getTripBatchDateValidationError(["2028-02-30"], validDates),
    { code: "INVALID_DATE", date: "2028-02-30" },
  );
  assert.deepEqual(
    getTripBatchDateValidationError(["2028-01-01"], validDates.slice(1)),
    { code: "INVALID_DATE", date: "2028-01-01" },
  );
  assert.deepEqual(
    getTripBatchDateValidationError([...validDates, "2028-01-08"], validDates),
    { code: "TOO_MANY_DATES" },
  );
});

test("rejects multiple trip definitions with the required error code", () => {
  assert.equal(
    getTripBatchPayloadError(1, 2),
    "MULTIPLE_CYCLES_NOT_SUPPORTED",
  );
  assert.equal(getTripBatchPayloadError(7, 1), null);
});

test("builds the batch response and retains legacy fields for a single trip", () => {
  const response = buildTripBatchResponse({
    batchId: "batch-1",
    candidates: [{ id: "trip-1", date: validDates[0], priceEgp: 120 }],
    waitlist: false,
  });
  assert.deepEqual(response, {
    batchId: "batch-1",
    trips: [{
      id: "trip-1",
      date: validDates[0],
      priceEgp: 120,
      status: "pending_payment",
      paymentStatus: "pending",
    }],
    totalEgp: 120,
    waitlist: false,
    tripId: "trip-1",
    bookingId: "trip-1",
    tripIds: ["trip-1"],
    amountEgp: 120,
    waitingList: false,
  });
});

test("multi-trip response has one status and price per date", () => {
  const response = buildTripBatchResponse({
    batchId: "batch-2",
    candidates: [
      { id: "trip-1", date: validDates[0], priceEgp: 100 },
      { id: "trip-2", date: validDates[1], priceEgp: 95 },
    ],
    waitlist: true,
  });
  assert.equal(response.totalEgp, 195);
  assert.equal(response.trips.length, 2);
  assert.ok(response.trips.every((trip) =>
    trip.status === "waiting_list" && trip.paymentStatus === "pending"
  ));
  assert.equal("tripId" in response, false);
});

test("chooses the standalone Trip initial status consistently", () => {
  assert.deepEqual(getInitialTripBookingState(true), {
    paymentStatus: "pending",
    status: "waiting_list",
  });
  assert.deepEqual(getInitialTripBookingState(false), {
    paymentStatus: "pending",
    status: "pending_payment",
  });
});

test("builds one counted, batch-keyed admin waitlist notification per admin", () => {
  const notifications = buildWaitingListCreatedTripBatchAdminNotifications({
    adminIds: ["admin-1"],
    tripId: "trip-1",
    batchId: "batch-3",
    tripCount: 3,
    routeSummary: "A → B",
    date: validDates[0],
  });
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].body, /3 trips/);
  assert.equal(notifications[0].data.batchId, "batch-3");
  assert.equal(notifications[0].data.tripCount, 3);
  assert.equal(notifications[0].data.linkUrl, "/admin/waiting-list");
  assert.equal(
    waitingListTripBatchDedupeKey("batch-3"),
    "batch:batch-3:waiting_list_created",
  );
});

test("localizes new multi-date API errors in English and Arabic", async () => {
  const [english, arabic] = await Promise.all([
    import("node:fs/promises").then(({ readFile }) =>
      readFile(new URL("../src/lib/i18n/messages/en.ts", import.meta.url), "utf8"),
    ),
    import("node:fs/promises").then(({ readFile }) =>
      readFile(new URL("../src/lib/i18n/messages/ar.ts", import.meta.url), "utf8"),
    ),
  ]);
  for (const code of [
    "TOO_MANY_DATES",
    "DUPLICATE_DATES",
    "MULTIPLE_CYCLES_NOT_SUPPORTED",
    "TOO_MANY_PENDING_TRIPS",
  ]) {
    assert.match(english, new RegExp(`errors\\.${code}`));
    assert.match(arabic, new RegExp(`errors\\.${code}`));
  }
});
