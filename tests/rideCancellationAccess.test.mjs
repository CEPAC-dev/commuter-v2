import test from "node:test";
import assert from "node:assert/strict";

const { getRideCancellationAccess } = await import("../src/lib/rideCancellationAccess.ts");

test("unauthenticated callers cannot cancel a ride", () => {
  assert.equal(getRideCancellationAccess(null, "driver-1"), "unauthorized");
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
