import test from "node:test";
import assert from "node:assert/strict";

const { CHAT_GRACE_MINUTES, getTripChatAccess } = await import(
  "../src/lib/tripChatAccess.ts"
);

const now = new Date("2026-10-14T13:00:00.000Z");
const trip = {
  _id: "trip-1",
  userId: "passenger-1",
  rideId: "ride-1",
  status: "confirmed",
};
const ride = {
  _id: "ride-1",
  driverId: "driver-1",
  status: "active",
  passengers: [{ tripId: "trip-1", status: "waiting" }],
};

function access(session, overrides = {}) {
  return getTripChatAccess({
    session,
    trip: { ...trip, ...overrides.trip },
    ride: overrides.ride === undefined ? { ...ride, ...overrides.rideChanges } : overrides.ride,
    now: overrides.now ?? now,
  });
}

test("passenger who owns the Trip can chat with its assigned Ride", () => {
  assert.deepEqual(access({ userId: "passenger-1", role: "passenger" }), {
    allowed: true,
    role: "passenger",
    canWrite: true,
    reason: "allowed",
  });
});

test("a different passenger cannot read or write the Trip chat", () => {
  assert.equal(
    access({ userId: "passenger-2", role: "passenger" }).reason,
    "not_participant",
  );
});

test("assigned driver can chat when the Trip remains on the Ride manifest", () => {
  assert.equal(
    access({ userId: "driver-1", role: "driver" }).canWrite,
    true,
  );
});

test("a different driver cannot read or write the Trip chat", () => {
  assert.equal(
    access({ userId: "driver-2", role: "driver" }).reason,
    "not_participant",
  );
});

test("driver assigned to a different Ride cannot access this Trip chat", () => {
  assert.equal(
    access(
      { userId: "driver-1", role: "driver" },
      { rideChanges: { _id: "ride-2" } },
    ).reason,
    "not_participant",
  );
});

test("cancelled Trip and cancelled Ride close participant chat", () => {
  assert.equal(
    access({ userId: "passenger-1", role: "passenger" }, {
      trip: { status: "cancelled" },
    }).reason,
    "chat_closed",
  );
  assert.equal(
    access({ userId: "passenger-1", role: "passenger" }, {
      rideChanges: { status: "cancelled" },
    }).reason,
    "chat_closed",
  );
});

test("completed Ride remains open during the configured grace period", () => {
  const completedAt = new Date(now.getTime() - (CHAT_GRACE_MINUTES - 1) * 60_000);
  assert.equal(
    access({ userId: "passenger-1", role: "passenger" }, {
      rideChanges: { status: "completed", completedAt },
    }).canWrite,
    true,
  );
});

test("completed Ride closes at and after the grace-period boundary", () => {
  const completedAt = new Date(now.getTime() - CHAT_GRACE_MINUTES * 60_000);
  assert.equal(
    access({ userId: "passenger-1", role: "passenger" }, {
      rideChanges: { status: "completed", completedAt },
    }).reason,
    "chat_closed",
  );
});

test("admin can read but cannot write regardless of Ride lifecycle", () => {
  assert.deepEqual(
    access({ userId: "admin-1", role: "admin" }, {
      trip: { status: "cancelled" },
      rideChanges: { status: "cancelled" },
    }),
    {
      allowed: true,
      role: "admin",
      canWrite: false,
      reason: "admin_read_only",
    },
  );
});

test("unassigned Ride closes passenger chat", () => {
  assert.equal(
    access({ userId: "passenger-1", role: "passenger" }, {
      rideChanges: { driverId: null },
    }).reason,
    "chat_closed",
  );
});

test("driver without a non-cancelled manifest entry is not a participant", () => {
  assert.equal(
    access({ userId: "driver-1", role: "driver" }, {
      rideChanges: {
        passengers: [{ tripId: "trip-1", status: "cancelled" }],
      },
    }).reason,
    "not_participant",
  );
});

test("missing completion time fails closed for participant chat", () => {
  assert.equal(
    access({ userId: "passenger-1", role: "passenger" }, {
      rideChanges: { status: "completed", completedAt: null },
    }).reason,
    "chat_closed",
  );
});
