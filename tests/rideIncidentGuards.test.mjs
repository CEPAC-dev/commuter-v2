import test from "node:test";
import assert from "node:assert/strict";

const { getRideIncidentReportDecision } = await import(
  "../src/lib/rideIncidentGuards.ts"
);

const base = {
  isAssignedDriver: true,
  rideStatus: "active",
  hasOpenIncident: false,
  type: "vehicle_breakdown",
  note: "Engine trouble",
};

test("incident report requires the assigned driver", () => {
  assert.deepEqual(
    getRideIncidentReportDecision({ ...base, isAssignedDriver: false }),
    { kind: "forbidden" },
  );
});

test("incident report accepts confirmed and active rides only", () => {
  assert.equal(
    getRideIncidentReportDecision({ ...base, rideStatus: "confirmed" }).kind,
    "allowed",
  );
  assert.equal(
    getRideIncidentReportDecision({ ...base, rideStatus: "completed" }).kind,
    "status_conflict",
  );
});

test("incident report rejects an existing open incident", () => {
  assert.equal(
    getRideIncidentReportDecision({ ...base, hasOpenIncident: true }).kind,
    "already_reported",
  );
});

test("incident report validates type and note length", () => {
  assert.equal(
    getRideIncidentReportDecision({ ...base, type: "unknown" }).kind,
    "invalid_type",
  );
  assert.equal(
    getRideIncidentReportDecision({ ...base, note: "x".repeat(301) }).kind,
    "note_too_long",
  );
  assert.equal(
    getRideIncidentReportDecision({ ...base, note: 123 }).kind,
    "invalid_note",
  );
});

test("incident report trims optional note text", () => {
  assert.deepEqual(
    getRideIncidentReportDecision({ ...base, note: "  Engine trouble  " }),
    { kind: "allowed", note: "Engine trouble" },
  );
  assert.deepEqual(
    getRideIncidentReportDecision({ ...base, note: "  " }),
    { kind: "allowed", note: undefined },
  );
});
