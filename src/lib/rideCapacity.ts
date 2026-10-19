import {
  getVehiclePassengerCapacity,
  VEHICLES,
} from "./config/vehicles.ts";

export function getTripPassengerCount(
  vehicleType: string,
  numberOfPassengers: number,
  extraPassengers = 0,
): number {
  const baseCount =
    Number.isInteger(numberOfPassengers) && numberOfPassengers > 0
      ? numberOfPassengers
      : 0;
  if (VEHICLES[vehicleType]?.ride !== "shared") return baseCount;

  const extraCount = Number.isFinite(extraPassengers)
    ? Math.max(0, Math.round(extraPassengers))
    : 0;
  return Math.max(baseCount, 1 + extraCount);
}

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
