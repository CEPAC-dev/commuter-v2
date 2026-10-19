import test from "node:test";
import assert from "node:assert/strict";

const {
  getCompletableTripIds,
  getNoShowTripIds,
} = await import("../src/lib/rideTripCompletion.ts");

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

test("only matched or confirmed no-show passengers move to terminal Trip status", () => {
  assert.deepEqual(
    getNoShowTripIds(
      [
        { tripId: "matched", status: "no_show" },
        { tripId: "confirmed", status: "no_show" },
        { tripId: "active", status: "no_show" },
        { tripId: "completed", status: "no_show" },
        { tripId: "cancelled", status: "no_show" },
        { tripId: "refunded", status: "no_show" },
        { tripId: "present", status: "on_board" },
      ],
      [
        { _id: "matched", status: "matched" },
        { _id: "confirmed", status: "confirmed" },
        { _id: "active", status: "active" },
        { _id: "completed", status: "completed" },
        { _id: "cancelled", status: "cancelled" },
        { _id: "refunded", status: "refunded" },
        { _id: "present", status: "matched" },
      ],
    ),
    ["matched", "confirmed"],
  );
});

test("end-ride no-show transition has guarded status and IDs-only audit", async () => {
  const { readFile } = await import("node:fs/promises");
  const route = await readFile(
    new URL("../src/app/api/actions/ride/[rideId]/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /getNoShowTripIds\(actionPassengers, linkedTrips\)/);
  assert.match(
    route,
    /status: \{ \$in: \["matched", "confirmed"\] \}[\s\S]*?\$set: \{ status: "no_show", noShowAt \}/,
  );
  assert.match(route, /action: "trip_no_show_marked"/);
  assert.match(
    route,
    /description: "Trip marked as no-show at ride end\."/,
  );
});
