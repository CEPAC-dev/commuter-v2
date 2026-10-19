import test from "node:test";
import assert from "node:assert/strict";

const { derivePin, verifyPin, PickupPinConfigError, assertPickupPinSecret } =
  await import("../src/lib/pickupPin.ts");

const secret = "a".repeat(32);

test("pickup PIN is deterministic and four digits", () => {
  const pin = derivePin("trip-1", "ride-1", 0, secret);
  assert.match(pin, /^\d{4}$/);
  assert.equal(pin, derivePin("trip-1", "ride-1", 0, secret));
});

test("pickup PIN changes with trip, ride, or version", () => {
  const baseline = derivePin("trip-1", "ride-1", 0, secret);
  assert.notEqual(derivePin("trip-2", "ride-1", 0, secret), baseline);
  assert.notEqual(derivePin("trip-1", "ride-2", 0, secret), baseline);
  assert.notEqual(derivePin("trip-1", "ride-1", 1, secret), baseline);
});

test("verification accepts only the derived four-digit value", () => {
  const pin = derivePin("trip-1", "ride-1", 0, secret);
  assert.equal(verifyPin(pin, "trip-1", "ride-1", 0, secret), true);
  const wrongPin = `${pin.slice(0, 3)}${pin.endsWith("0") ? "1" : "0"}`;
  assert.equal(verifyPin(wrongPin, "trip-1", "ride-1", 0, secret), false);
  assert.equal(verifyPin("123", "trip-1", "ride-1", 0, secret), false);
  assert.equal(verifyPin("12a4", "trip-1", "ride-1", 0, secret), false);
});

test("missing and short secrets fail closed with explicit config codes", () => {
  assert.throws(
    () => assertPickupPinSecret(""),
    (error) =>
      error instanceof PickupPinConfigError &&
      error.code === "PICKUP_PIN_SECRET_MISSING",
  );
  assert.throws(
    () => assertPickupPinSecret("too-short"),
    (error) =>
      error instanceof PickupPinConfigError &&
      error.code === "PICKUP_PIN_SECRET_TOO_SHORT",
  );
});
