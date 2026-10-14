import test from "node:test";
import assert from "node:assert/strict";

const { getRideActionStatusDecision, RIDE_ACTION_ALLOWED_STATUSES } = await import(
  "../src/lib/rideActionGuards.ts"
);

const statuses = ["matched", "confirmed", "active", "completed", "cancelled"];

test("ride action guards cover every action and lifecycle status pair", () => {
  for (const action of Object.keys(RIDE_ACTION_ALLOWED_STATUSES)) {
    for (const status of statuses) {
      const decision = getRideActionStatusDecision(action, status);
      const expectedKind =
        (action === "start_ride" && status === "active") ||
        (action === "end_ride" && status === "completed")
          ? "idempotent"
          : RIDE_ACTION_ALLOWED_STATUSES[action].includes(status)
            ? "allowed"
            : "conflict";
      assert.equal(
        decision.kind,
        expectedKind,
        `${action} from ${status}`,
      );
    }
  }
});

test("repeated start on an active ride is idempotent", () => {
  assert.deepEqual(getRideActionStatusDecision("start_ride", "active"), {
    kind: "idempotent",
  });
});

test("repeated end on a completed ride is idempotent", () => {
  assert.deepEqual(getRideActionStatusDecision("end_ride", "completed"), {
    kind: "idempotent",
  });
});

test("unknown ride actions are rejected", () => {
  assert.deepEqual(getRideActionStatusDecision("unknown", "active"), {
    kind: "unknown_action",
  });
});
