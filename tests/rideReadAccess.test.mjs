import test from "node:test";
import assert from "node:assert/strict";

const { getRideReadAccess, projectPassengerRide } = await import(
  "../src/lib/rideReadAccess.ts"
);

const passengerSession = { role: "passenger", userId: "passenger-1" };

test("Ride list access is limited to admins, assigned drivers, and participants", () => {
  assert.equal(
    getRideReadAccess({
      session: { role: "admin", userId: "admin-1" },
      rideDriverId: "driver-1",
      hasNonCancelledPassengerTrip: false,
    }),
    "admin",
  );
  assert.equal(
    getRideReadAccess({
      session: { role: "driver", userId: "driver-1" },
      rideDriverId: "driver-1",
      hasNonCancelledPassengerTrip: false,
    }),
    "driver",
  );
  assert.equal(
    getRideReadAccess({
      session: { role: "driver", userId: "driver-2" },
      rideDriverId: "driver-1",
      hasNonCancelledPassengerTrip: false,
    }),
    "forbidden",
  );
  assert.equal(
    getRideReadAccess({
      session: passengerSession,
      rideDriverId: "driver-1",
      hasNonCancelledPassengerTrip: true,
    }),
    "passenger",
  );
  assert.equal(
    getRideReadAccess({
      session: passengerSession,
      rideDriverId: "driver-1",
      hasNonCancelledPassengerTrip: false,
    }),
    "forbidden",
  );
  assert.equal(
    getRideReadAccess({
      session: null,
      rideDriverId: "driver-1",
      hasNonCancelledPassengerTrip: true,
    }),
    "unauthenticated",
  );
});

test("passenger Ride projection excludes other passengers and stale driver contact details", () => {
  const ride = {
    id: "ride-1",
    passengerCount: 5,
    chatTripId: "trip-1",
    passengers: [
      { tripId: "trip-1", status: "waiting", numberOfPassengers: 2 },
      { tripId: "trip-2", status: "waiting", numberOfPassengers: 3 },
      { tripId: "trip-3", status: "cancelled", numberOfPassengers: 1 },
    ],
  };
  const projected = projectPassengerRide(ride, ["trip-1", "trip-3"]);
  assert.deepEqual(projected?.passengers, [ride.passengers[0]]);
  assert.equal(projected?.passengerCount, 2);
  assert.equal(projected?.chatTripId, "trip-1");
  assert.equal("driverPhone" in (projected ?? {}), false);
  assert.equal(projectPassengerRide(ride, ["trip-3"]), null);
});
