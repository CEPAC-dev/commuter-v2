import test from "node:test";
import assert from "node:assert/strict";

const { getTripHistoryCategory, matchesTripHistoryFilter } = await import(
  "../src/lib/tripHistory.ts"
);
const now = new Date("2026-10-03T09:00:00.000Z");

test("history categories distinguish terminal and expired stages", () => {
  assert.equal(
    getTripHistoryCategory({ status: "submitted" }, { status: "completed" }, now),
    "completed",
  );
  assert.equal(
    getTripHistoryCategory({ status: "submitted" }, { status: "cancelled" }, now),
    "cancelled",
  );
  assert.equal(
    getTripHistoryCategory({ status: "submitted" }, { status: "refunded" }, now),
    "refunded",
  );
  assert.equal(
    getTripHistoryCategory({ status: "rejected" }, { status: "cancelled" }, now),
    "rejected",
  );
  assert.equal(
    getTripHistoryCategory(
      { status: "pending_payment", hasPastTrip: true },
      { status: "pending_payment", date: "2026-10-05", pickupTime: "09:00" },
      now,
    ),
    "expired",
  );
});

test("history filters only match Requests containing the requested category", () => {
  const request = { status: "submitted" };
  const trips = [{ status: "completed" }, { status: "cancelled" }];
  assert.equal(matchesTripHistoryFilter("all", request, trips, now), true);
  assert.equal(matchesTripHistoryFilter("completed", request, trips, now), true);
  assert.equal(matchesTripHistoryFilter("cancelled", request, trips, now), true);
  assert.equal(matchesTripHistoryFilter("refunded", request, trips, now), false);
  assert.equal(
    matchesTripHistoryFilter("all", request, [{ status: "submitted" }], now),
    false,
  );
});