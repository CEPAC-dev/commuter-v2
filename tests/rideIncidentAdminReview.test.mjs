import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  getIncidentResolutionDecision,
  needsIncidentFollowUp,
  shouldResetTripForIncidentCancellation,
} = await import("../src/lib/rideIncidentAdminGuards.ts");
const { getRideIncidentWithdrawalDecision } = await import(
  "../src/lib/rideIncidentGuards.ts"
);
const {
  getRideIncidentOutcomeNotificationPayload,
  getRideIncidentPassengerNotificationPayload,
} = await import("../src/lib/notifications/rideIncidentPayload.ts");

const base = {
  incidentStatus: "open",
  rideStatus: "active",
  action: "continue",
  adminNote: "Reviewed and safe to proceed",
  penaltyEgp: undefined,
  maxPenaltyEgp: 500,
};

test("incident resolution permits continue and cancellation only on valid ride states", () => {
  assert.equal(getIncidentResolutionDecision(base).kind, "allowed");
  for (const action of ["cancel_no_penalty", "cancel_with_penalty"]) {
    assert.equal(
      getIncidentResolutionDecision({ ...base, action, penaltyEgp: 0 }).kind,
      "allowed",
    );
    assert.equal(
      getIncidentResolutionDecision({
        ...base,
        action,
        rideStatus: "completed",
        penaltyEgp: 0,
      }).kind,
      "ride_status_conflict",
    );
  }
  assert.equal(
    getIncidentResolutionDecision({
      ...base,
      rideStatus: "completed",
    }).kind,
    "allowed",
  );
});

test("incident resolution rejects resolved incidents and invalid admin notes", () => {
  assert.equal(
    getIncidentResolutionDecision({
      ...base,
      incidentStatus: "resolved",
    }).kind,
    "already_resolved",
  );
  assert.equal(
    getIncidentResolutionDecision({ ...base, adminNote: "  " }).kind,
    "note_required",
  );
  assert.equal(
    getIncidentResolutionDecision({
      ...base,
      adminNote: "x".repeat(501),
    }).kind,
    "note_too_long",
  );
});

test("incident penalty accepts zero and rejects negative or above the maximum", () => {
  const withPenalty = { ...base, action: "cancel_with_penalty" };
  assert.equal(
    getIncidentResolutionDecision({ ...withPenalty, penaltyEgp: 0 }).kind,
    "allowed",
  );
  assert.equal(
    getIncidentResolutionDecision({ ...withPenalty, penaltyEgp: -0.01 }).kind,
    "invalid_penalty",
  );
  assert.equal(
    getIncidentResolutionDecision({ ...withPenalty, penaltyEgp: 500.01 }).kind,
    "penalty_too_large",
  );
});

test("incident cancellation resets only not-yet-picked-up trips", () => {
  assert.equal(shouldResetTripForIncidentCancellation("matched", "waiting"), true);
  assert.equal(shouldResetTripForIncidentCancellation("active", "no_show"), true);
  for (const pickupStatus of ["boarding", "on_board", "picked_up", "dropped_off"]) {
    assert.equal(
      shouldResetTripForIncidentCancellation("active", pickupStatus),
      false,
    );
    assert.equal(needsIncidentFollowUp("active", pickupStatus), true);
  }
  assert.equal(shouldResetTripForIncidentCancellation("completed", "waiting"), false);
  assert.equal(needsIncidentFollowUp("completed", "waiting"), true);
  assert.equal(needsIncidentFollowUp("matched", "waiting"), false);
});

test("withdrawal decisions require the assigned driver and an open incident", () => {
  assert.equal(
    getRideIncidentWithdrawalDecision({
      isAssignedDriver: false,
      incidentStatus: "open",
    }).kind,
    "forbidden",
  );
  assert.equal(
    getRideIncidentWithdrawalDecision({
      isAssignedDriver: true,
      incidentStatus: null,
    }).kind,
    "no_open_incident",
  );
  assert.equal(
    getRideIncidentWithdrawalDecision({
      isAssignedDriver: true,
      incidentStatus: "open",
    }).kind,
    "allowed",
  );
});

test("incident notification payloads omit phone numbers and report notes", () => {
  const sensitivePhone = "+201001234567";
  const privateNote = "PRIVATE INCIDENT NOTE";
  const payloads = [
    getRideIncidentPassengerNotificationPayload({
      incidentId: "incident-id",
      tripId: "trip-id",
    }),
    getRideIncidentOutcomeNotificationPayload({
      dedupeKey: "incident-id:cancelled",
      outcome: "cancelled",
      recipient: "passenger",
      tripId: "trip-id",
    }),
    getRideIncidentOutcomeNotificationPayload({
      dedupeKey: "incident-id:continue",
      outcome: "continue",
      recipient: "driver",
    }),
  ];
  for (const payload of payloads) {
    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes(sensitivePhone), false);
    assert.equal(serialized.includes(privateNote), false);
    assert.equal(serialized.includes("phone"), false);
    assert.equal(serialized.includes("note"), false);
  }
});

test("all admin incident routes apply adminAuth before data access", async () => {
  const paths = [
    "../src/app/api/admin/incidents/route.ts",
    "../src/app/api/admin/incidents/[id]/route.ts",
    "../src/app/api/admin/incidents/[id]/resolve/route.ts",
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /const authorization = await adminAuth\(\);/);
    assert.match(
      source,
      /if \(!authorization\.authorized\) return authorization\.response;/,
    );
  }
  const authSource = await readFile(
    new URL("../src/lib/middleware/adminAuth.ts", import.meta.url),
    "utf8",
  );
  assert.match(authSource, /user\.role !== "admin"/);
});
