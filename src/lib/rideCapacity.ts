import {
  getVehiclePassengerCapacity,
  VEHICLES,
  type RideType,
} from "./config/vehicles.ts";

export function getTripPassengerCount(
  vehicleType: string,
  numberOfPassengers: number,
  extraPassengers = 0,
  rideType: RideType = VEHICLES[vehicleType]?.ride ?? "private",
): number {
  const baseCount =
    Number.isInteger(numberOfPassengers) && numberOfPassengers > 0
      ? numberOfPassengers
      : 0;
  if (rideType !== "shared") return baseCount;

  const extraCount = Number.isFinite(extraPassengers)
    ? Math.max(0, Math.round(extraPassengers))
    : 0;
  return Math.max(baseCount, 1 + extraCount);
}

export function isVehiclePassengerCountAllowed(
  vehicleType: string,
  passengerCount: number,
  capacity = getVehiclePassengerCapacity(vehicleType),
): boolean {
  return (
    Number.isInteger(passengerCount) &&
    passengerCount >= 1 &&
    Number.isInteger(capacity) &&
    capacity > 0 &&
    passengerCount <= capacity
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
