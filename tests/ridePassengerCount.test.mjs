import test from "node:test";
import assert from "node:assert/strict";

const {
  countRidePassengers,
  decrementRidePassengerCount,
} = await import("../src/lib/ridePassengerCount.ts");

test("cancelling a one-person Trip removes one person from the Ride counter", () => {
  assert.equal(decrementRidePassengerCount(4, 1), 3);
});

test("cancelling a three-person Trip removes all three people atomically", () => {
  assert.equal(decrementRidePassengerCount(7, 3), 4);
});

test("cancelling a three-person shared Trip uses the shared booking definition", async () => {
  const { getTripPassengerCount } = await import("../src/lib/rideCapacity.ts");
  const cancelledPeople = getTripPassengerCount("van_shared", 1, 2);
  assert.equal(decrementRidePassengerCount(7, cancelledPeople), 4);
});

test("Ride passenger counts are people, not RidePassenger entries", () => {
  assert.equal(countRidePassengers([1, 3, 2]), 6);
});

test("Ride passenger counter never decrements below zero", () => {
  assert.equal(decrementRidePassengerCount(2, 3), 0);
});
