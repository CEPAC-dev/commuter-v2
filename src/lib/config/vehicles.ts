export type VehicleKey =
  | "private_car"
  | "taxi_private"
  | "taxi_shared"
  | "van_shared"
  | "microbus_shared";
export type RideType = "private" | "shared";

export interface VehicleConfig {
  key: VehicleKey;
  label: string;
  rate: number; // EGP per km
  ride: RideType;
  buffer: number; // minutes subtracted before the pickup window
  window: number; // width of the pickup window in minutes
  capacity: number; // max seats (integer, placeholder until user edits)
  occupancy: number; // current occupancy (integer, placeholder)
  min_occupancy: number; // minimum occupancy required (integer, placeholder)
}

export const VEHICLES: Record<VehicleKey, VehicleConfig> = {
  private_car: {
    key: "private_car",
    label: "Private car",
    rate: 15,
    ride: "private",
    buffer: 20,
    window: 10,
    capacity: 4,
    occupancy: 4,
    min_occupancy: 1,
  },
  taxi_private: {
    key: "taxi_private",
    label: "Private Taxi",
    rate: 12,
    ride: "private",
    buffer: 20,
    window: 10,
    capacity: 4,
    occupancy: 4,
    min_occupancy: 1,
  },
  taxi_shared: {
    key: "taxi_shared",
    label: "Shared Taxi",
    rate: 10,
    ride: "shared",
    buffer: 30,
    window: 20,
    capacity: 4,
    occupancy: 3,
    min_occupancy: 2,
  },
  van_shared: {
    key: "van_shared",
    label: "Van",
    rate: 7,
    ride: "shared",
    buffer: 45,
    window: 25,
    capacity: 7,
    occupancy: 6,
    min_occupancy: 4,
  },
  microbus_shared: {
    key: "microbus_shared",
    label: "Microbus",
    rate: 4,
    ride: "shared",
    buffer: 45,
    window: 30,
    capacity: 14,
    occupancy: 10,
    min_occupancy: 8,
  },
};

export const VEHICLE_LIST = Object.values(VEHICLES);

export function priceFor(
  distanceKm: number,
  key: VehicleKey,
  vehiclesMap: Record<VehicleKey, VehicleConfig> = VEHICLES,
): number {
  return Math.round(vehiclesMap[key].rate * Math.pow(distanceKm, 0.8));
}

/** Private-ride wait charge: each 60 minutes costs 50 km at 50% of vehicle rate. */
export function waitingCostEgp(
  waitingMinutes: number,
  key: VehicleKey,
  vehiclesMap: Record<VehicleKey, VehicleConfig> = VEHICLES,
): number {
  const minutes = Number.isFinite(waitingMinutes)
    ? Math.max(0, waitingMinutes)
    : 0;
  return Math.round((minutes / 60) * (50 * vehiclesMap[key].rate * 0.5));
}

/** Max extra passengers allowed per vehicle type */
export function maxExtraPassengers(key: VehicleKey | ""): number {
  if (key === "taxi_shared") return 2;
  if (key === "van_shared") return 4;
  if (key === "microbus_shared") return 9;
  return 2; // private_car, taxi_private, taxi_shared, or unset
}

/**
 * Final price factoring in extra passengers.
 * Formula: round(basePrice * totalPeople * 1.05) when extraPassengers > 0,
 * else basePrice unchanged.
 */
export function finalPrice(
  basePrice: number,
  extraPassengers: number,
  vehicleType: VehicleKey | "",
): number {
  const n = extraPassengers;
  // const r = (factor: number) => Math.round(basePrice * (n + 1) * factor);
  const r = (factor: number) => Math.round(basePrice + basePrice * factor);

  if (vehicleType === "private_car" || vehicleType === "taxi_private") {
    if (n === 1) return r(0.1);
    if (n === 2) return r(0.2);
    if (n === 3) return r(0.3);
    return basePrice;
  }

  if (vehicleType === "taxi_shared") {
    if (n === 1) return r(0.5);
    if (n === 2) return r(1);
    return basePrice;
  }

  if (vehicleType === "van_shared") {
    if (n === 1) return r(0.5);
    if (n === 2) return r(1);
    if (n === 3) return r(1.5);
    if (n === 4) return r(2);
    return basePrice;
  }

  if (vehicleType === "microbus_shared") {
    if (n === 1) return r(0.5);
    if (n === 2) return r(1);
    if (n === 3) return r(1.5);
    if (n === 4) return r(2);
    if (n === 5) return r(2.5);
    if (n === 6) return r(3);
    if (n === 7) return r(3.5);
    if (n === 8) return r(4);
    if (n === 9) return r(4.5);
    return basePrice;
  }

  return basePrice;
}

export interface PrivateFareLeg {
  distanceKm: number;
  passengers: number;
}

/** Split route base fare by distance, then apply private passenger pricing per leg. */
export function privateRouteLegPrices(
  legs: PrivateFareLeg[],
  key: VehicleKey,
  vehiclesMap: Record<VehicleKey, VehicleConfig> = VEHICLES,
): number[] {
  const totalDistanceKm = legs.reduce(
    (sum, leg) => sum + Math.max(0, leg.distanceKm),
    0,
  );
  if (totalDistanceKm <= 0) return legs.map(() => 0);

  const baseRoutePrice = priceFor(totalDistanceKm, key, vehiclesMap);
  return legs.map((leg) => {
    const legBasePrice =
      (baseRoutePrice * Math.max(0, leg.distanceKm)) / totalDistanceKm;
    return finalPrice(
      legBasePrice,
      Math.max(0, Math.round(leg.passengers) - 1),
      key,
    );
  });
}

export function privateRoutePrice(
  legs: PrivateFareLeg[],
  key: VehicleKey,
  vehiclesMap: Record<VehicleKey, VehicleConfig> = VEHICLES,
): number {
  return privateRouteLegPrices(legs, key, vehiclesMap).reduce(
    (sum, price) => Math.round(sum + price),
    0,
  );
}
