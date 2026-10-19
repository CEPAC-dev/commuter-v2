import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";

const { createPickupPinAuditRecord, sanitizePickupPinFields } = await import(
  "../src/lib/pickupPinSafety.ts"
);

const enteredPin = "4827";
const rideProjection = {
  id: "ride-1",
  passengers: [
    {
      tripId: "trip-1",
      passengerNumber: 1,
      pickupPin: enteredPin,
      nested: { PIN: enteredPin, pickup_pin: enteredPin },
    },
  ],
};

function assertPinAbsent(value) {
  assert.equal(JSON.stringify(value).includes(enteredPin), false);
  assert.deepEqual(sanitizePickupPinFields(value), value);
}

test("driver loader and GET ride projections omit PIN values", () => {
  const driverLoaderOutput = sanitizePickupPinFields(rideProjection);
  const getRideResponse = sanitizePickupPinFields({ data: rideProjection });

  assertPinAbsent(driverLoaderOutput);
  assertPinAbsent(getRideResponse);
  assert.equal("pickupPin" in driverLoaderOutput.passengers[0], false);
});

test("Action Center response and notification payloads omit PIN fields", () => {
  const actionResponse = sanitizePickupPinFields({
    success: true,
    action: "station_arrived",
    result: { pin: enteredPin, passengerNumber: 1 },
  });
  const notificationPayload = sanitizePickupPinFields({
    tripId: "trip-1",
    data: { title: "Ride complete", pickupPin: enteredPin },
  });

  assertPinAbsent(actionResponse);
  assertPinAbsent(notificationPayload);
});

test("pickup PIN audit records do not contain entered PIN values", () => {
  const record = createPickupPinAuditRecord({
    tripId: new Types.ObjectId(),
    rideId: new Types.ObjectId().toString(),
    userId: new Types.ObjectId(),
    driverId: new Types.ObjectId().toString(),
    status: "confirmed",
    action: "pickup_pin_failed",
    failedAttempts: 1,
  });

  assertPinAbsent(record);
  assert.equal(record.description.includes(enteredPin), false);
  assert.deepEqual(record.metadata, { failedAttempts: 1 });
});

test("nested ride/action log metadata strips PIN-named fields", () => {
  const metadata = sanitizePickupPinFields({
    confirmations: [{ tripId: "trip-1", pin: enteredPin, status: "arrived" }],
    nested: { pickupPin: enteredPin, pickup_pin: enteredPin },
  });

  assertPinAbsent(metadata);
  assert.deepEqual(metadata, {
    confirmations: [{ tripId: "trip-1", status: "arrived" }],
    nested: {},
  });
});
