import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { selectModifiedNomatchTrips } = await import(
  "../src/lib/nomatchLogging.ts"
);

test("only Trips whose guarded update modified a document are logged once", async () => {
  const candidates = [
    { _id: "trip-1", userId: "user-1" },
    { _id: "trip-2", userId: "user-2" },
  ];
  const logs = [];
  const runSweep = (transitionedIds) => {
    const transitioned = selectModifiedNomatchTrips(
      candidates,
      transitionedIds,
    );
    logs.push(...transitioned.map((trip) => trip._id));
  };

  runSweep(["trip-1"]);
  runSweep([]);
  assert.deepEqual(logs, ["trip-1"]);

  const route = await readFile(
    new URL("../src/app/api/trips/expire/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /Trip\.updateOne\([\s\S]*?\.\.\.nomatchFilter/);
  assert.match(route, /selectModifiedNomatchTrips\([\s\S]*nomatchUpdates/);
  assert.match(route, /transitionedTrips\.map\(\(trip\) => logTripNomatch/);
});
