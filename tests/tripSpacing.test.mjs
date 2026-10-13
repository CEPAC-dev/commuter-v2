import test from "node:test";
import assert from "node:assert/strict";

const { findSpacingConflict, hasSpacingConflict } = await import(
  "../src/lib/validation/tripSpacing.ts"
);

const existingTrip = (arrivalTime, status = "pending_payment", extra = {}) => ({
  date: "2026-10-30",
  arrivalTime,
  status,
  ...extra,
});

test("blocks touching and overlapping arrival windows", () => {
  assert.equal(
    hasSpacingConflict(
      { date: "2026-10-30", arrivalTime: "07:45" },
      [existingTrip("07:15")],
    ),
    true,
  );
  assert.equal(
    hasSpacingConflict(
      { date: "2026-10-30", arrivalTime: "07:15" },
      [existingTrip("07:15")],
    ),
    true,
  );
});

test("allows exactly thirty minutes between arrival windows", () => {
  assert.equal(
    hasSpacingConflict(
      { date: "2026-10-30", arrivalTime: "08:15" },
      [existingTrip("07:15")],
    ),
    false,
  );
});

test("trips on different dates do not conflict", () => {
  assert.equal(
    hasSpacingConflict(
      { date: "2026-10-31", arrivalTime: "07:15" },
      [existingTrip("07:15")],
    ),
    false,
  );
});

test("freed statuses do not hold an arrival window", () => {
  for (const status of [
    "cancelled",
    "time_out",
    "rejected",
    "refunded",
    "nomatch",
    "completed",
  ]) {
    assert.equal(
      hasSpacingConflict(
        { date: "2026-10-30", arrivalTime: "07:15" },
        [existingTrip("07:15", status)],
      ),
      false,
      `${status} should free the window`,
    );
  }
});

test("every holding status keeps its arrival window", () => {
  for (const status of [
    "pending_payment",
    "waiting_list",
    "approved",
    "submitted",
    "matched",
    "confirmed",
    "active",
  ]) {
    assert.equal(
      hasSpacingConflict(
        { date: "2026-10-30", arrivalTime: "07:15" },
        [existingTrip("07:15", status)],
      ),
      true,
      `${status} should hold the window`,
    );
  }
});

test("legacy Request-backed trips still hold their arrival window", () => {
  assert.notEqual(
    findSpacingConflict(
      { date: "2026-10-30", arrivalTime: "07:15" },
      [existingTrip("07:15", "waiting_list", { requestId: "legacy-request" })],
    ),
    null,
  );
});

test("matches the 7:00–7:30 example using stored slot midpoints", () => {
  const existing = [existingTrip("07:15")];
  const cases = [
    ["06:15", false],
    ["06:45", true],
    ["07:15", true],
    ["07:45", true],
    ["08:15", false],
  ];

  for (const [arrivalTime, expectedConflict] of cases) {
    assert.equal(
      hasSpacingConflict(
        { date: "2026-10-30", arrivalTime },
        existing,
      ),
      expectedConflict,
      `arrivalTime ${arrivalTime}`,
    );
  }
});
