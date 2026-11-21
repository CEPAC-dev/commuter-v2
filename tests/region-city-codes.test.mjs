import assert from "node:assert/strict";
import test from "node:test";
import {
  formatOperatingCityCode,
  getNextOperatingCityCode,
  getOperatingCityCounterId,
  getOperatingCitySequence,
} from "../src/lib/regions/cityCodes.ts";

test("generates the next code from the selected Region's existing city codes", () => {
  assert.equal(
    getNextOperatingCityCode("EGY", ["cairo", "egy-1", "EGY-4", "ksa-9"]),
    "EGY-5",
  );
  assert.equal(getNextOperatingCityCode("KSA", ["riyadh"]), "KSA-1");
});

test("preserves a higher sequence counter and ignores invalid suffixes", () => {
  assert.equal(
    getNextOperatingCityCode("UAE", ["abu-dhabi", "uae-2x"], 6),
    "UAE-7",
  );
  assert.equal(getOperatingCitySequence("EGY-12", "EGY"), 12);
  assert.equal(getOperatingCitySequence("KSA-2", "EGY"), 0);
});

test("uses a Region-specific counter id and formats user-facing codes", () => {
  assert.equal(getOperatingCityCounterId("EGY"), "operating-city-code:EGY");
  assert.equal(formatOperatingCityCode("UAE", 3), "UAE-3");
});
