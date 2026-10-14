import test from "node:test";
import assert from "node:assert/strict";

const { getCompletableTripIds } = await import("../src/lib/rideTripCompletion.ts");

test("only active trips without cancelled or no-show ride passengers are completable", () => {
  const result = getCompletableTripIds(
    [
      { tripId: "cancelled-active", status: "cancelled" },
      { tripId: "no-show-active", status: "no_show" },
      { tripId: "picked-up", status: "boarding" },
      { tripId: "still-confirmed", status: "waiting" },
    ],
    [
      { _id: "cancelled-active", status: "active" },
      { _id: "no-show-active", status: "active" },
      { _id: "picked-up", status: "active" },
      { _id: "cancelled-trip", status: "cancelled" },
      { _id: "refunded-trip", status: "refunded" },
      { _id: "still-confirmed", status: "confirmed" },
    ],
  );

  assert.deepEqual(result, ["picked-up"]);
});

test("returns no completion candidates when no active trips exist", () => {
  assert.deepEqual(
    getCompletableTripIds([], [
      { _id: "confirmed", status: "confirmed" },
      { _id: "cancelled", status: "cancelled" },
    ]),
    [],
  );
});
