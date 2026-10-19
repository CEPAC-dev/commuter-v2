import test from "node:test";
import assert from "node:assert/strict";

const {
  canPassengerSeeDriverPhone,
  serializePassengerAssignedDriver,
} = await import("../src/lib/driverPhoneVisibility.ts");
const { projectPublicTrip } = await import("../src/lib/liveShare/logic.ts");

const trip = {
  _id: "trip-1",
  userId: "passenger-1",
  driverId: "driver-1",
  rideId: "ride-1",
  status: "active",
};
const ride = {
  _id: "ride-1",
  driverId: "driver-1",
  status: "active",
  passengers: [{ tripId: "trip-1", status: "on_board" }],
};

test("driver phone is visible to the owning passenger during a linked live ride", () => {
  assert.deepEqual(
    canPassengerSeeDriverPhone({ userId: "passenger-1", trip, ride }),
    { allowed: true, reason: "allowed" },
  );
});

test("phone visibility fails closed for owner, linkage, assignment, ride and trip status", () => {
  const denied = [
    [{ userId: "another-passenger", trip, ride }, "not_owner"],
    [{ userId: "passenger-1", trip: { ...trip, rideId: "other" }, ride }, "trip_not_linked"],
    [{ userId: "passenger-1", trip, ride: { ...ride, driverId: null } }, "driver_missing"],
    [{ userId: "passenger-1", trip, ride: { ...ride, driverId: "new-driver" } }, "driver_reassigned"],
    [{ userId: "passenger-1", trip, ride: { ...ride, status: "matched" } }, "ride_not_live"],
    [{ userId: "passenger-1", trip, ride: { ...ride, status: "completed" } }, "ride_not_live"],
    ...["cancelled", "completed", "refunded", "nomatch", "expired", "time_out"].map((status) => [
      { userId: "passenger-1", trip: { ...trip, status }, ride },
      "trip_ended",
    ]),
    [{ userId: "passenger-1", trip, ride: { ...ride, passengers: [] } }, "passenger_not_in_ride"],
    [{ userId: "passenger-1", trip, ride: { ...ride, passengers: [{ tripId: "trip-1", status: "cancelled" }] } }, "passenger_not_in_ride"],
  ];
  for (const [input, reason] of denied) {
    assert.deepEqual(canPassengerSeeDriverPhone(input), { allowed: false, reason });
  }
  assert.equal(canPassengerSeeDriverPhone({ userId: "passenger-1", trip, ride: null }).allowed, false);
});

test("serialized passenger data strips stale snapshot phone unless gate permits current phone", () => {
  const snapshot = { name: "Driver", phone: "stale-number" };
  assert.deepEqual(
    serializePassengerAssignedDriver(snapshot, { allowed: false, reason: "ride_not_live" }, "current-number"),
    { name: "Driver" },
  );
  assert.deepEqual(
    serializePassengerAssignedDriver(snapshot, { allowed: true, reason: "allowed" }, "current-number"),
    { name: "Driver", phone: "current-number" },
  );
});

test("public live-share projection never includes a driver's phone number", () => {
  const projection = projectPublicTrip({
    status: "active",
    pickup: { lat: 30, lng: 31 },
    dropoff: { lat: 30.1, lng: 31.1 },
    assignedDriver: { name: "Driver Name", phone: "01012345678" },
  }, null);
  assert.equal(JSON.stringify(projection).includes("01012345678"), false);
  assert.equal(projection.driver.firstName, "Driver");
});
