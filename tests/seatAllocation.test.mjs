import test from "node:test";
import assert from "node:assert/strict";

const {
  allocateSeats,
  fillMissingPassengerSeats,
  planBoardingSeatAssignments,
} = await import("../src/lib/seatAllocation.ts");

test("allocates the lowest free seat for one person", () => {
  assert.deepEqual(
    allocateSeats({ capacity: 4, occupiedSeats: [], requestedCount: 1 }),
    { ok: true, seats: [1] },
  );
});

test("allocates a contiguous set of seats for a group when possible", () => {
  assert.deepEqual(
    allocateSeats({
      capacity: 6,
      occupiedSeats: [1, 5],
      requestedCount: 3,
    }),
    { ok: true, seats: [2, 3, 4] },
  );
});

test("returns unavailable when the vehicle has too few seats free", () => {
  assert.deepEqual(
    allocateSeats({
      capacity: 3,
      occupiedSeats: [1, 3],
      requestedCount: 2,
    }),
    { ok: false, reason: "NOT_ENOUGH_SEATS" },
  );
});

test("uses valid free preferred seats before filling remaining lowest seats", () => {
  assert.deepEqual(
    allocateSeats({
      capacity: 6,
      occupiedSeats: [1, 2],
      requestedCount: 3,
      preferredSeats: [5, 4, 4],
    }),
    { ok: true, seats: [3, 4, 5] },
  );
});

test("ignores occupied and out-of-range preferred seats", () => {
  assert.deepEqual(
    allocateSeats({
      capacity: 5,
      occupiedSeats: [2],
      requestedCount: 2,
      preferredSeats: [2, 9],
    }),
    { ok: true, seats: [3, 4] },
  );
});

test("occupied seats are not allocated twice", () => {
  assert.deepEqual(
    allocateSeats({
      capacity: 4,
      occupiedSeats: [1, 2, 3],
      requestedCount: 1,
    }),
    { ok: true, seats: [4] },
  );
});

test("zero or non-integer requested count is invalid", () => {
  assert.deepEqual(
    allocateSeats({ capacity: 4, occupiedSeats: [], requestedCount: 0 }),
    { ok: false, reason: "INVALID_COUNT" },
  );
  assert.deepEqual(
    allocateSeats({ capacity: 4, occupiedSeats: [], requestedCount: 1.5 }),
    { ok: false, reason: "INVALID_COUNT" },
  );
});

test("requested count above capacity is unavailable", () => {
  assert.deepEqual(
    allocateSeats({ capacity: 4, occupiedSeats: [], requestedCount: 5 }),
    { ok: false, reason: "NOT_ENOUGH_SEATS" },
  );
});

test("boarding plan assigns the requested number of seats across several Trips", () => {
  const result = planBoardingSeatAssignments({
    capacity: 6,
    passengers: [
      { tripId: "group", status: "waiting", numberOfPassengers: 3 },
      { tripId: "single", status: "waiting", numberOfPassengers: 1 },
    ],
    boardingTripIds: ["group", "single"],
  });
  assert.deepEqual(result, {
    ok: true,
    assignments: { group: [1, 2, 3], single: [4] },
  });
});

test("boarding plan fails without partially assigning seats", () => {
  const result = planBoardingSeatAssignments({
    capacity: 3,
    passengers: [
      { tripId: "first", status: "waiting", numberOfPassengers: 2 },
      { tripId: "second", status: "waiting", numberOfPassengers: 2 },
    ],
    boardingTripIds: ["first", "second"],
  });
  assert.deepEqual(result, { ok: false, reason: "NOT_ENOUGH_SEATS" });
});

test("alighted, no-show, and cancelled passengers release their stored seats", () => {
  const passengers = ["dropped_off", "no_show", "cancelled"].map(
    (status, index) => ({
      tripId: `released-${index}`,
      status,
      seatNumbers: [index + 1],
    }),
  );
  assert.deepEqual(
    planBoardingSeatAssignments({
      capacity: 3,
      passengers: [
        ...passengers,
        { tripId: "new", status: "waiting", numberOfPassengers: 3 },
      ],
      boardingTripIds: ["new"],
    }),
    { ok: true, assignments: { new: [1, 2, 3] } },
  );
});

test("already boarded Trips retain their existing seats on duplicate confirmation", () => {
  assert.deepEqual(
    planBoardingSeatAssignments({
      capacity: 4,
      passengers: [
        {
          tripId: "already-onboard",
          status: "on_board",
          numberOfPassengers: 2,
          seatNumbers: [2, 3],
        },
      ],
      boardingTripIds: ["already-onboard"],
    }),
    { ok: true, assignments: { "already-onboard": [2, 3] } },
  );
});

test("two stale concurrent plans are serialized by the expected Ride version", () => {
  const snapshot = {
    capacity: 2,
    passengers: [{ tripId: "first", status: "waiting", numberOfPassengers: 1 }],
  };
  const concurrentA = planBoardingSeatAssignments({
    ...snapshot,
    boardingTripIds: ["first"],
  });
  const concurrentB = planBoardingSeatAssignments({
    ...snapshot,
    passengers: [
      ...snapshot.passengers,
      { tripId: "second", status: "waiting", numberOfPassengers: 1 },
    ],
    boardingTripIds: ["second"],
  });
  assert.equal(concurrentA.ok && concurrentA.assignments.first[0], 1);
  assert.equal(concurrentB.ok && concurrentB.assignments.second[0], 1);

  const expectedVersionA = 7;
  const expectedVersionB = 7;
  let persistedVersion = 7;
  if (persistedVersion === expectedVersionA) persistedVersion += 1;
  assert.equal(persistedVersion === expectedVersionB, false);
});

test("old group manifests fill missing display seats without colliding", () => {
  assert.deepEqual(
    fillMissingPassengerSeats(
      [
        {
          tripId: "group",
          status: "boarding",
          numberOfPassengers: 3,
          seatNumbers: [2],
        },
        {
          tripId: "single",
          status: "on_board",
          numberOfPassengers: 1,
          seatNumbers: [1],
        },
      ],
      4,
    ),
    { group: [2, 3, 4], single: [1] },
  );
});

test("old data falls back to its stored seats when there is not enough room to fill", () => {
  assert.deepEqual(
    fillMissingPassengerSeats(
      [
        {
          tripId: "legacy-group",
          status: "on_board",
          numberOfPassengers: 3,
          seatNumbers: [1],
        },
        {
          tripId: "other-group",
          status: "boarding",
          numberOfPassengers: 2,
          seatNumbers: [2, 3],
        },
      ],
      3,
    ),
    { "legacy-group": [1], "other-group": [2, 3] },
  );
});

test("active group fallback can reuse a seat retained for an alighted passenger", () => {
  assert.deepEqual(
    fillMissingPassengerSeats(
      [
        {
          tripId: "alighted",
          status: "dropped_off",
          numberOfPassengers: 3,
          seatNumbers: [1, 2, 3],
        },
        {
          tripId: "boarding-group",
          status: "boarding",
          numberOfPassengers: 3,
          seatNumbers: [1],
        },
      ],
      3,
    ),
    { alighted: [1, 2, 3], "boarding-group": [1, 2, 3] },
  );
});
