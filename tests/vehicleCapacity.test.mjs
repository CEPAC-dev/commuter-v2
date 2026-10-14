import test from "node:test";
import assert from "node:assert/strict";

const { VEHICLES, getVehiclePassengerCapacity } = await import(
  "../src/lib/config/vehicles.ts"
);
const { getVehicleSeatGrid } = await import("../src/lib/vehicleSeatGrid.ts");

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
