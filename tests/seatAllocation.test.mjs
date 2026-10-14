import test from "node:test";
import assert from "node:assert/strict";

const { allocateSeats } = await import("../src/lib/seatAllocation.ts");

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
