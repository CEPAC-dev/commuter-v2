import test from "node:test";
import assert from "node:assert/strict";

const {
  VEHICLES,
  getVehiclePassengerCapacity,
  maxExtraPassengers,
} = await import(
  "../src/lib/config/vehicles.ts"
);
const { getVehicleSeatGrid } = await import("../src/lib/vehicleSeatGrid.ts");
const { allocateSeats } = await import("../src/lib/seatAllocation.ts");
const {
  getTripPassengerCount,
  isRideWithinCapacity,
  isVehiclePassengerCountAllowed,
} = await import("../src/lib/rideCapacity.ts");

test("unknown vehicle types use a conservative capacity fallback", () => {
  assert.equal(getVehiclePassengerCapacity("unknown_vehicle"), 1);
});

test("every vehicle grid has exactly its configured passenger capacity", () => {
  for (const [vehicleType, vehicle] of Object.entries(VEHICLES)) {
    const grid = getVehicleSeatGrid(vehicleType);
    const passengerSeats = grid.rows
      .flat()
      .filter((cell) => cell.seatNumber !== null);

    assert.equal(
      passengerSeats.length,
      getVehiclePassengerCapacity(vehicleType),
      `${vehicleType} grid passenger-seat count`,
    );
    assert.equal(grid.totalSeats, vehicle.capacity, `${vehicleType} totalSeats`);
  }
});

test("mini buses keep their own seat-map label", () => {
  const grid = getVehicleSeatGrid("mini_bus");
  assert.equal(grid.label, "Mini Bus");
  assert.equal(grid.labelKey, "vehicle_seating.vehicle_type_mini_bus");
});

test("Trip creation rejects groups above configured vehicle capacity", () => {
  for (const vehicleType of Object.keys(VEHICLES)) {
    const capacity = getVehiclePassengerCapacity(vehicleType);
    assert.equal(isVehiclePassengerCountAllowed(vehicleType, capacity), true);
    assert.equal(isVehiclePassengerCountAllowed(vehicleType, capacity + 1), false);
  }
  assert.equal(getTripPassengerCount("private_car", 3, 8), 3);
  assert.equal(getTripPassengerCount("microbus_shared", 1, 8), 9);
  assert.equal(getTripPassengerCount("microbus_shared", 3, 1), 3);
  assert.equal(getTripPassengerCount("microbus_shared", 1, 9), 10);
  assert.equal(
    isVehiclePassengerCountAllowed(
      "microbus_shared",
      getTripPassengerCount("microbus_shared", 1, 9),
    ),
    false,
  );
});

test("shared cars have three seats while private cars remain at four", () => {
  for (const vehicleType of ["shared_car", "taxi_shared"]) {
    assert.equal(getVehiclePassengerCapacity(vehicleType), 3);
    assert.equal(
      getVehicleSeatGrid(vehicleType).rows
        .flat()
        .filter((cell) => cell.seatNumber !== null).length,
      3,
    );
    assert.equal(maxExtraPassengers(vehicleType), 2);
    assert.equal(
      isVehiclePassengerCountAllowed(
        vehicleType,
        getTripPassengerCount(vehicleType, 1, 2),
      ),
      true,
    );
    assert.equal(
      isVehiclePassengerCountAllowed(
        vehicleType,
        getTripPassengerCount(vehicleType, 1, 3),
      ),
      false,
    );
    assert.equal(
      isVehiclePassengerCountAllowed(vehicleType, 4),
      false,
      `${vehicleType} rejects a four-person booking`,
    );
    assert.deepEqual(
      allocateSeats({
        capacity: getVehiclePassengerCapacity(vehicleType),
        occupiedSeats: [],
        requestedCount: 3,
      }),
      { ok: true, seats: [1, 2, 3] },
    );
  }

  for (const vehicleType of ["private_car", "taxi_private"]) {
    assert.equal(getVehiclePassengerCapacity(vehicleType), 4);
    assert.equal(
      getVehicleSeatGrid(vehicleType).rows
        .flat()
        .filter((cell) => cell.seatNumber !== null).length,
      4,
    );
    assert.equal(isVehiclePassengerCountAllowed(vehicleType, 4), true);
    assert.deepEqual(
      allocateSeats({
        capacity: getVehiclePassengerCapacity(vehicleType),
        occupiedSeats: [],
        requestedCount: 4,
      }),
      { ok: true, seats: [1, 2, 3, 4] },
    );
  }
});

test("per-booking and shared extra-passenger limits follow configured capacity", () => {
  for (const [vehicleType, vehicle] of Object.entries(VEHICLES)) {
    assert.equal(
      maxExtraPassengers(vehicleType),
      getVehiclePassengerCapacity(vehicleType) - 1,
      `${vehicleType} maximum extra passengers`,
    );
    if (vehicle.ride === "shared") {
      assert.equal(
        maxExtraPassengers(vehicleType),
        getVehiclePassengerCapacity(vehicleType) - 1,
        `${vehicleType} extra-passenger limit`,
      );
    }
  }
});

test("Ride matching rejects passenger sums above the selected vehicle capacity", () => {
  assert.equal(isRideWithinCapacity("van_shared", [2, 3]), true);
  assert.equal(isRideWithinCapacity("van_shared", [2, 2, 2]), false);
  // Matching preserves the existing unmatched fallback when this is false.
  assert.equal(isRideWithinCapacity("van_shared", [3, 3]), false);
});

test("seat allocation uses the same capacity as each vehicle grid", () => {
  for (const vehicleType of Object.keys(VEHICLES)) {
    const capacity = getVehiclePassengerCapacity(vehicleType);
    assert.equal(
      allocateSeats({
        capacity,
        occupiedSeats: [],
        requestedCount: capacity,
      }).ok,
      true,
      `${vehicleType} can allocate its configured capacity`,
    );
    assert.equal(
      allocateSeats({
        capacity,
        occupiedSeats: [],
        requestedCount: capacity + 1,
      }).ok,
      false,
      `${vehicleType} rejects beyond configured capacity`,
    );
  }
});
