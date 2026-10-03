import test from "node:test";
import assert from "node:assert/strict";

const { getNextTrip } = await import("../src/lib/nextTrip.ts");
const now = new Date("2026-10-03T09:00:00.000Z");
const today = "2026-10-03";

function trip(id, status, date, pickupTime, parentRequestStatus = status) {
  return { id, requestId: id, status, parentRequestStatus, date, pickupTime };
}

test("active trip wins over upcoming trips", () => {
  const next = getNextTrip({
    trips: [
      trip("upcoming", "submitted", "2026-10-03", "16:00"),
      trip("active", "active", "2026-10-02", "10:00"),
    ],
    now,
  });
  assert.equal(next?.id, "active");
});

test("earliest upcoming pickup wins", () => {
  const next = getNextTrip({
    trips: [
      trip("late", "confirmed", "2026-10-04", "10:00"),
      trip("early", "matched", today, "13:00"),
    ],
    now,
  });
  assert.equal(next?.id, "early");
});

test("past upcoming pickups are ignored", () => {
  assert.equal(
    getNextTrip({ trips: [trip("past", "submitted", today, "11:59")], now }),
    null,
  );
});

test("pending and waiting-list trips are ignored", () => {
  assert.equal(
    getNextTrip({
      trips: [
        trip("pending", "pending_payment", "2026-10-04", "09:00"),
        trip("waiting", "pending_payment", "2026-10-04", "10:00", "waiting_list"),
      ],
      now,
    }),
    null,
  );
});

test("cancelled and refunded trips are ignored", () => {
  assert.equal(
    getNextTrip({
      trips: [
        trip("cancelled", "cancelled", "2026-10-04", "09:00"),
        trip("refunded", "refunded", "2026-10-04", "10:00"),
      ],
      now,
    }),
    null,
  );
});

test("nomatch can be upcoming before pickup but not after pickup", () => {
  assert.equal(
    getNextTrip({ trips: [trip("soon", "nomatch", today, "13:00")], now })?.id,
    "soon",
  );
  assert.equal(
    getNextTrip({ trips: [trip("past", "nomatch", today, "11:59")], now }),
    null,
  );
});

test("pickup exactly at now is not selected as a future trip", () => {
  assert.equal(
    getNextTrip({ trips: [trip("now", "confirmed", today, "12:00")], now }),
    null,
  );
});

test("empty list returns null", () => {
  assert.equal(getNextTrip({ trips: [], now }), null);
});