import test from "node:test";
import assert from "node:assert/strict";

const {
  getRideActionStatusDecision,
  RIDE_ACTION_ALLOWED_STATUSES,
  shouldBlockRideActionForOpenIncident,
} = await import("../src/lib/rideActionGuards.ts");

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

  test("an open incident blocks ride start and pickup actions", () => {
    for (const action of [
      "start_ride",
      "pickup_arrived",
      "passenger_picked_up",
    ]) {
      assert.equal(
        getRideActionStatusDecision(action, action === "start_ride" ? "confirmed" : "active", true)
          .kind,
        "incident_open",
      );
    }
  });

  test("an open incident blocks boarding transitions but not alighting", () => {
    assert.equal(
      getRideActionStatusDecision("boarding_alighting", "active", true, true).kind,
      "incident_open",
    );
    assert.equal(
      getRideActionStatusDecision("boarding_alighting", "active", true, false).kind,
      "allowed",
    );
    assert.equal(
      getRideActionStatusDecision("station_arrived", "active", true, true).kind,
      "incident_open",
    );
    assert.equal(
      getRideActionStatusDecision("station_arrived", "active", true, false).kind,
      "allowed",
    );
  });

  test("no-show, alighting-only station actions, and ending remain allowed", () => {
    for (const action of ["no_show", "station_arrived", "end_ride"]) {
      assert.equal(
        getRideActionStatusDecision(
          action,
          action === "end_ride" ? "active" : "active",
          true,
          false,
        ).kind,
        "allowed",
      );
    }
  });

  test("pickup intent helper only blocks pickup transitions", () => {
    assert.equal(
      shouldBlockRideActionForOpenIncident("station_arrived", true, true),
      true,
    );
    assert.equal(
      shouldBlockRideActionForOpenIncident("station_arrived", true, false),
      false,
    );
    assert.equal(shouldBlockRideActionForOpenIncident("end_ride", true), false);
  });
});
