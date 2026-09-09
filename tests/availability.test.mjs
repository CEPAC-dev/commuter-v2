import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidAvailabilityId,
  normalizeAvailabilityOrigin,
  validateAvailabilityWindow,
} from "../src/lib/time/availabilityWindow.ts";

test("accepts an availability window of exactly eight hours", () => {
  assert.equal(validateAvailabilityWindow("08:00", "16:00"), null);
  assert.equal(validateAvailabilityWindow("09:00", "17:00"), null);
});

test("rejects availability longer than eight hours", () => {
  assert.equal(
    validateAvailabilityWindow("08:00", "16:01"),
    "Availability cannot exceed 8 hours.",
  );
  assert.equal(
    validateAvailabilityWindow("08:00", "17:00"),
    "Availability cannot exceed 8 hours.",
  );
});

test("rejects invalid or reversed availability times", () => {
  assert.equal(
    validateAvailabilityWindow("17:00", "08:00"),
    "End time must be after start time.",
  );
  assert.equal(
    validateAvailabilityWindow("08:00", "08:00"),
    "End time must be after start time.",
  );
  assert.equal(
    validateAvailabilityWindow("8:00", "16:00"),
    "Start and end time are required in HH:MM format.",
  );
});

test("normalizes valid origins and rejects invalid ids", () => {
  assert.deepEqual(
    normalizeAvailabilityOrigin({ address: "Cairo", lat: "30.0444", lng: "31.2357" }),
    { address: "Cairo", lat: 30.0444, lng: 31.2357 },
  );
  assert.equal(normalizeAvailabilityOrigin({ address: "Cairo", lat: "bad", lng: 31.2 }), null);
  assert.equal(isValidAvailabilityId("not-a-valid-object-id"), false);
  assert.equal(isValidAvailabilityId("507f1f77bcf86cd799439011"), true);
});
