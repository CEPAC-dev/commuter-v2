import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const stateKey = "commuter.admin.live-location-test";
const state = {
  authorized: true,
  trip: null,
  ride: null,
  queries: [],
  reads: [],
  location: null,
};
globalThis[Symbol.for(stateKey)] = state;

const mockedModules = new Map([
  [
    "@/lib/middleware/adminAuth",
    `export async function adminAuth() {
      const state = globalThis[Symbol.for(${JSON.stringify(stateKey)})];
      return state.authorized
        ? { authorized: true, userId: "admin" }
        : { authorized: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
    }`,
  ],
  [
    "@/lib/liveLocation/store",
    `export async function readDriverLocation(subjectType, subjectId) {
      const state = globalThis[Symbol.for(${JSON.stringify(stateKey)})];
      state.reads.push([subjectType, subjectId]);
      return state.location;
    }`,
  ],
  [
    "@/lib/liveShare/errors",
    "export function logLiveShareFailure() {}",
  ],
  [
    "@/models/Trip",
    `const state = globalThis[Symbol.for(${JSON.stringify(stateKey)})];
    export const Trip = {
      findById(id) {
        state.queries.push(["trip", id]);
        return { select() { return { lean: async () => state.trip }; } };
      },
    };`,
  ],
  [
    "@/models/Ride",
    `const state = globalThis[Symbol.for(${JSON.stringify(stateKey)})];
    export const Ride = {
      findById(id) {
        state.queries.push(["ride", id]);
        return { select() { return { lean: async () => state.ride }; } };
      },
    };`,
  ],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const source = mockedModules.get(specifier);
    if (source) {
      return {
        url: `data:text/javascript,${encodeURIComponent(source)}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const [{ GET: getTripLocation }, { GET: getRideLocation }] = await Promise.all([
  import("../src/app/api/admin/trips/[id]/live-location/route.ts"),
  import("../src/app/api/admin/rides/[id]/live-location/route.ts"),
]);

const tripId = "507f1f77bcf86cd799439011";
const rideId = "507f1f77bcf86cd799439012";

function resetState() {
  state.authorized = true;
  state.trip = null;
  state.ride = null;
  state.queries = [];
  state.reads = [];
  state.location = {
    lat: 30,
    lng: 31,
    accuracy: 10,
    heading: null,
    speed: null,
    recordedAt: new Date("2026-01-01T10:00:00.000Z"),
    receivedAt: new Date("2026-01-01T10:00:00.000Z"),
    ageSeconds: 0,
    stale: false,
  };
}

beforeEach(resetState);

function requestContext(id) {
  return {
    params: Promise.resolve({ id }),
  };
}

test("admin authentication is required before reading trip location", async () => {
  state.authorized = false;

  const response = await getTripLocation(
    new Request(`http://localhost/api/admin/trips/${tripId}/live-location`),
    requestContext(tripId),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(state.queries, []);
  assert.deepEqual(state.reads, []);
});

test("active trips read the location from their linked ride", async () => {
  state.trip = { _id: tripId, status: "active", rideId };

  const response = await getTripLocation(
    new Request(`http://localhost/api/admin/trips/${tripId}/live-location`),
    requestContext(tripId),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    active: true,
    location: JSON.parse(JSON.stringify(state.location)),
  });
  assert.deepEqual(state.reads, [["ride", rideId]]);
});

test("inactive rides do not expose a stored driver location", async () => {
  state.ride = { _id: rideId, status: "completed" };

  const response = await getRideLocation(
    new Request(`http://localhost/api/admin/rides/${rideId}/live-location`),
    requestContext(rideId),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { active: false, location: null });
  assert.deepEqual(state.reads, []);
});

test("active ride details return the latest ride location", async () => {
  state.ride = { _id: rideId, status: "active" };

  const response = await getRideLocation(
    new Request(`http://localhost/api/admin/rides/${rideId}/live-location`),
    requestContext(rideId),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(state.reads, [["ride", rideId]]);
});
