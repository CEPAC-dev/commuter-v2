import test from "node:test";
import assert from "node:assert/strict";

const { getTripTab } = await import("../src/lib/tripTabs.ts");
const { getDisplayStatus } = await import("../src/lib/statusDisplay.ts");
const { getCairoNowParts } = await import("../src/lib/time/cairoTime.ts");
const { hasPastTrip } = await import("../src/lib/admin/waitingList.ts");
const now = new Date("2026-10-03T09:00:00.000Z");

test("private unpaid trip is pending", () => {
  assert.equal(
    getTripTab({
      request: { status: "pending_payment" },
      trip: { status: "pending_payment", date: "2026-10-05", pickupTime: "09:00" },
      now,
    }),
    "pending",
  );
});

test("waiting-list trip is pending after the creation-time toggle decision", () => {
  assert.equal(
    getTripTab({
      request: { status: "waiting_list" },
      trip: { status: "pending_payment", date: "2026-10-05", pickupTime: "09:00" },
      now,
    }),
    "pending",
  );
});

test("approved request with a past pickup belongs to history", () => {
  assert.equal(
    getTripTab({
      request: {
        status: "approved",
        trips: [{ date: "2026-10-02", pickupTime: "10:00" }],
      },
      trip: { status: "pending_payment", date: "2026-10-05", pickupTime: "09:00" },
      now,
    }),
    "history",
  );
});

test("ordinary pending-payment request with a past pickup belongs to history", () => {
  assert.equal(
    getTripTab({
      request: { status: "pending_payment" },
      trip: { status: "pending_payment", date: "2026-10-02", pickupTime: "10:00" },
      now,
    }),
    "history",
  );
});

test("nomatch is upcoming before pickup and history after pickup", () => {
  assert.equal(
    getTripTab({
      request: { status: "submitted" },
      trip: { status: "nomatch", date: "2026-10-05", pickupTime: "09:00" },
      now,
    }),
    "upcoming",
  );
  assert.equal(
    getTripTab({
      request: { status: "submitted" },
      trip: { status: "nomatch", date: "2026-10-02", pickupTime: "09:00" },
      now,
    }),
    "history",
  );
});

test("one past trip puts every trip in a multi-day pending request in history", () => {
  const request = {
    status: "pending_payment",
    trips: [
      { date: "2026-10-02", pickupTime: "10:00" },
      { date: "2026-10-05", pickupTime: "10:00" },
    ],
  };
  assert.equal(
    getTripTab({
      request,
      trip: { status: "pending_payment", date: "2026-10-05", pickupTime: "10:00" },
      now,
    }),
    "history",
  );
});

test("unknown status values safely fall into history", () => {
  assert.equal(
    getTripTab({
      request: { status: "legacy_request" },
      trip: { status: "legacy_trip", date: "2026-10-05", pickupTime: "09:00" },
      now,
    }),
    "history",
  );
});

test("all pickup-time consumers agree for past, future, now, and multi-day fixtures", () => {
  const nowParts = getCairoNowParts(now);
  const fixtures = [
    {
      name: "past",
      trips: [{ date: nowParts.dateStr, pickupTime: "11:59" }],
      expectedPast: true,
      expectedTab: "history",
      expectedDisplay: "status.expired",
    },
    {
      name: "future",
      trips: [{ date: nowParts.dateStr, pickupTime: "12:01" }],
      expectedPast: false,
      expectedTab: "pending",
      expectedDisplay: "status.pending_payment",
    },
    {
      name: "exactly now",
      trips: [{ date: nowParts.dateStr, pickupTime: nowParts.timeStr }],
      expectedPast: false,
      expectedTab: "pending",
      expectedDisplay: "status.pending_payment",
    },
    {
      name: "multi-day with one past trip",
      trips: [
        { date: "2026-10-02", pickupTime: "23:59" },
        { date: "2026-10-05", pickupTime: "09:00" },
      ],
      expectedPast: true,
      expectedTab: "history",
      expectedDisplay: "status.expired",
    },
  ];

  for (const fixture of fixtures) {
    const request = { status: "pending_payment", paymentStatus: "pending", trips: fixture.trips };
    const targetTrip = fixture.trips.at(-1);
    assert.equal(hasPastTrip(fixture.trips, nowParts), fixture.expectedPast, fixture.name);
    assert.equal(
      getTripTab({ request, trip: { ...targetTrip, status: "pending_payment" }, now }),
      fixture.expectedTab,
      fixture.name,
    );
    assert.equal(
      getDisplayStatus({
        request,
        trip: { ...targetTrip, status: "pending_payment" },
        now,
      }).key,
      fixture.expectedDisplay,
      fixture.name,
    );
  }
});