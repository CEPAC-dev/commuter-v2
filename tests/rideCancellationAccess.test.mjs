import test from "node:test";
import assert from "node:assert/strict";

const {
  getRideCancellationAccess,
  getDriverRideCancellationDecision,
} = await import("../src/lib/rideCancellationAccess.ts");

test("unauthenticated callers cannot cancel a ride", () => {
  assert.equal(getRideCancellationAccess(null, "driver-1"), "unauthorized");
});

test("active driver cancellation requires an incident report", () => {
  assert.equal(
    getDriverRideCancellationDecision("driver", "active"),
    "use_incident_report",
  );
});

test("confirmed driver cancellation remains allowed", () => {
  assert.equal(
    getDriverRideCancellationDecision("driver", "confirmed"),
    "allowed",
  );
});

test("admin cancellation behavior is unchanged for active rides", () => {
  assert.equal(
    getDriverRideCancellationDecision("admin", "active"),
    "allowed",
  );
});

test("a different driver cannot cancel the ride", () => {
  assert.equal(
    getRideCancellationAccess({ role: "driver", userId: "driver-2" }, "driver-1"),
    "forbidden",
  );
});

test("the assigned driver is allowed to cancel the ride", () => {
  assert.equal(
    getRideCancellationAccess({ role: "driver", userId: "driver-1" }, "driver-1"),
    "driver",
  );
});

test("an admin is allowed to cancel any ride", () => {
  assert.equal(
    getRideCancellationAccess({ role: "admin", userId: "admin-1" }, "driver-1"),
    "admin",
  );
});

test("other authenticated roles cannot cancel rides", () => {
  assert.equal(
    getRideCancellationAccess({ role: "user", userId: "user-1" }, "driver-1"),
    "forbidden",
  );
});

test("passenger mutation access is limited to admins and the assigned driver", () => {
  assert.equal(getRideCancellationAccess(null, "driver-1"), "unauthorized");
  assert.equal(
    getRideCancellationAccess({ role: "passenger", userId: "passenger-1" }, "driver-1"),
    "forbidden",
  );
  assert.equal(
    getRideCancellationAccess({ role: "driver", userId: "driver-2" }, "driver-1"),
    "forbidden",
  );
  assert.equal(
    getRideCancellationAccess({ role: "driver", userId: "driver-1" }, "driver-1"),
    "driver",
  );
  assert.equal(
    getRideCancellationAccess({ role: "admin", userId: "admin-1" }, "driver-1"),
    "admin",
  );
});
