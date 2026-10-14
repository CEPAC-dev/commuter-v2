import { getVehiclePassengerCapacity } from "./config/vehicles.ts";

export function isVehiclePassengerCountAllowed(
  vehicleType: string,
  passengerCount: number,
): boolean {
  return (
    Number.isInteger(passengerCount) &&
    passengerCount >= 1 &&
    passengerCount <= getVehiclePassengerCapacity(vehicleType)
  );
}

export function isRideWithinCapacity(
  vehicleType: string,
  passengerCounts: readonly number[],
): boolean {
  return (
    passengerCounts.every(
      (passengerCount) =>
        Number.isInteger(passengerCount) && passengerCount >= 1,
    ) &&
    passengerCounts.reduce((total, passengerCount) => total + passengerCount, 0) <=
      getVehiclePassengerCapacity(vehicleType)
  );
}
