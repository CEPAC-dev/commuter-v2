import test from "node:test";
import assert from "node:assert/strict";

const { groupIdenticalWaitingListTripFields } = await import(
  "../src/lib/admin/waitingListTripFields.ts"
);

const trip = {
  pickup: "Downtown",
  dropoff: "Airport",
  pickupTime: "08:30",
  arrivalTime: "09:15",
  numberOfPassengers: 2,
  preferedGender: "female",
};

test("collapses fields identical across all waiting-list trip days", () => {
  const result = groupIdenticalWaitingListTripFields([
    trip,
    { ...trip },
  ]);
  assert.deepEqual(result.sharedFields, [
    "pickup",
    "dropoff",
    "pickupTime",
    "arrivalTime",
    "numberOfPassengers",
    "preferedGender",
  ]);
  assert.deepEqual(result.perTripFields, [
    { index: 0, fields: [] },
    { index: 1, fields: [] },
  ]);
});

test("returns differing fields for each trip day", () => {
  const result = groupIdenticalWaitingListTripFields([
    trip,
    { ...trip, pickupTime: "09:00", numberOfPassengers: 3 },
  ]);
  assert.deepEqual(result.sharedFields, [
    "pickup",
    "dropoff",
    "arrivalTime",
    "preferedGender",
  ]);
  assert.deepEqual(result.perTripFields, [
    { index: 0, fields: ["pickupTime", "numberOfPassengers"] },
    { index: 1, fields: ["pickupTime", "numberOfPassengers"] },
  ]);
});

test("a single waiting-list trip shares all its details", () => {
  const result = groupIdenticalWaitingListTripFields([trip]);
  assert.equal(result.sharedFields.length, 6);
  assert.deepEqual(result.perTripFields, [{ index: 0, fields: [] }]);
});
