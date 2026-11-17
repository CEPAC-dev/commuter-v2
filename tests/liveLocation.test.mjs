import test from "node:test";
import assert from "node:assert/strict";

const { calculateTripProgress } = await import(
  "../src/lib/liveLocation/progress.ts"
);
const { parseDriverLocationUpdate } = await import(
  "../src/lib/liveLocation/types.ts"
);
const { projectPublicTrip } = await import(
  "../src/lib/liveShare/logic.ts"
);

test("calculates remaining route distance and an approximate ETA from GPS speed", () => {
  const progress = calculateTripProgress({
    position: { lat: 0, lng: 0.005, speed: 10 },
    destination: { lat: 0, lng: 0.02 },
    route: [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.01 },
      { lat: 0, lng: 0.02 },
    ],
  });

  assert.ok(progress.remainingDistanceKm > 1.5);
  assert.ok(progress.remainingDistanceKm < 1.8);
  assert.equal(progress.etaMinutes, 3);
});

test("does not invent an ETA when GPS speed is unavailable", () => {
  const progress = calculateTripProgress({
    position: { lat: 30, lng: 31, speed: null },
    destination: { lat: 30.01, lng: 31.01 },
  });

  assert.ok(progress.remainingDistanceKm > 0);
  assert.equal(progress.etaMinutes, null);
});

test("validates realtime driver location payloads", () => {
  const value = {
    lat: 30.0444,
    lng: 31.2357,
    accuracy: 10,
    heading: 120,
    speed: 6,
    recordedAt: "2026-11-09T15:00:00.000Z",
    receivedAt: "2026-11-09T15:00:01.000Z",
  };

  assert.deepEqual(parseDriverLocationUpdate(value), value);
  assert.equal(parseDriverLocationUpdate({ ...value, lat: 91 }), null);
  assert.equal(parseDriverLocationUpdate({ ...value, recordedAt: "invalid" }), null);
});

test("projects driver location only while live tracking is active", () => {
  const now = new Date("2026-11-09T15:00:10.000Z");
  const trip = {
    tripId: "trip-1",
    trackingActive: true,
    status: "active",
    pickup: { lat: 30, lng: 31 },
    dropoff: { lat: 30.1, lng: 31.1 },
    driverLocation: {
      lat: 30.05,
      lng: 31.05,
      accuracy: 12,
      heading: 80,
      speed: 4,
      recordedAt: new Date("2026-11-09T15:00:09.000Z"),
      receivedAt: new Date("2026-11-09T15:00:09.000Z"),
    },
  };

  const active = projectPublicTrip(trip, null, now);
  assert.equal(active.tripId, "trip-1");
  assert.equal(active.driverLocation.lat, 30.05);
  assert.equal(active.driverLocation.stale, false);

  const inactive = projectPublicTrip(
    { ...trip, trackingActive: false },
    null,
    now,
  );
  assert.equal(inactive.driverLocation, null);
});

test("marks old driver locations stale without exposing a location history", () => {
  const now = new Date("2026-11-09T15:01:00.000Z");
  const result = projectPublicTrip(
    {
      tripId: "trip-1",
      trackingActive: true,
      status: "active",
      pickup: { lat: 30, lng: 31 },
      dropoff: { lat: 30.1, lng: 31.1 },
      driverLocation: {
        lat: 30.05,
        lng: 31.05,
        accuracy: null,
        heading: null,
        speed: null,
        recordedAt: new Date("2026-11-09T15:00:00.000Z"),
        receivedAt: new Date("2026-11-09T15:00:00.000Z"),
      },
    },
    null,
    now,
  );

  assert.equal(result.driverLocation.stale, true);
  assert.equal("locationHistory" in result, false);
});
