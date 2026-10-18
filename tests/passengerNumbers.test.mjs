import test from "node:test";
import assert from "node:assert/strict";

const {
  assignMissingPassengerNumbers,
  getNextPassengerNumber,
} = await import("../src/lib/passengerNumbers.ts");

test("legacy Ride passengers receive numbers in array order", () => {
  const result = assignMissingPassengerNumbers(
    [{ tripId: "trip-a" }, { tripId: "trip-b" }, { tripId: "trip-c" }],
  );

  assert.deepEqual(
    result.passengers.map((passenger) => passenger.passengerNumber),
    [1, 2, 3],
  );
  assert.equal(result.sequence, 3);
});

test("new passenger numbers are not reused after a passenger is removed", () => {
  const retainedPassengers = [
    { tripId: "trip-a", passengerNumber: 1 },
    { tripId: "trip-b", passengerNumber: 2 },
  ];
  const sequenceBeforeCancellation = 3;

  assert.equal(
    getNextPassengerNumber(retainedPassengers, sequenceBeforeCancellation),
    4,
  );
  assert.deepEqual(
    assignMissingPassengerNumbers(
      [...retainedPassengers, { tripId: "trip-d" }],
      sequenceBeforeCancellation,
    ).passengers.map((passenger) => passenger.passengerNumber),
    [1, 2, 4],
  );
});

test("existing passenger numbers are preserved while missing numbers are filled", () => {
  const result = assignMissingPassengerNumbers(
    [
      { tripId: "trip-a", passengerNumber: 2 },
      { tripId: "trip-b" },
      { tripId: "trip-c", passengerNumber: 4 },
    ],
    4,
  );

  assert.deepEqual(
    result.passengers.map((passenger) => passenger.passengerNumber),
    [2, 5, 4],
  );
  assert.equal(result.sequence, 5);
});
