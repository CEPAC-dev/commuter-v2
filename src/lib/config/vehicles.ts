import { bookingWindow } from "../time/bookingDates.ts";

export type VehicleKey =
  | "private_car"
  | "taxi_private"
  | "taxi_shared"
  | "shared_car"
  | "van_shared"
  | "microbus_shared";
export type RideType = "private" | "shared";

export interface VehicleConfig {
  key: VehicleKey;
  label: string;
  rate: number; // EGP per km
  additional_rate: number; // EGP per km for extra passengers
  ride: RideType;
  vehicle_type: number; // 1=private car, 2=taxi, 3=van, 4=microbus, 5=shared car
  trip_type: number; // 1=private, 2=taxi_private, 3=taxi_shared, 4=van_shared, 5=microbus_shared, 6=shared_car
  buffer: number; // minutes subtracted before the pickup window
  window: number; // width of the pickup window in minutes
  capacity: number; // max seats (integer, placeholder until user edits)
  occupancy: number; // current occupancy (integer, placeholder)
  min_occupancy: number; // minimum occupancy required (integer, placeholder)
  minimum_charge: number; // EGP minimum charge for this vehicle type
}

export const VEHICLES: Record<VehicleKey, VehicleConfig> = {
  private_car: {
    key: "private_car",
    label: "Private Car",
    rate: 8,
    additional_rate: 0.25, // EGP per km for extra passengers
    ride: "private",
    vehicle_type: 1,
    trip_type: 1,
    buffer: 20,
    window: 10,
    capacity: 4,
    occupancy: 4,
    min_occupancy: 1,
    minimum_charge: 75, // EGP minimum charge for private car rides
  },
  taxi_private: {
    key: "taxi_private",
    label: "Private Taxi",
    rate: 6,
    additional_rate: 0.25, // EGP per km for extra passengers
    ride: "private",
    vehicle_type: 2,
    trip_type: 2,
    buffer: 20,
    window: 10,
    capacity: 4,
    occupancy: 4,
    min_occupancy: 1,
    minimum_charge: 75, // EGP minimum charge for private taxi rides
  },
  taxi_shared: {
    key: "taxi_shared",
    label: "Shared Taxi",
    rate: 5,
    additional_rate: 0.5, // EGP per km for extra passengers
    ride: "shared",
    vehicle_type: 2,
    trip_type: 3,
    buffer: 30,
    window: 20,
    capacity: 3,
    occupancy: 3,
    min_occupancy: 1.5,
    minimum_charge: 50, // EGP minimum charge for shared taxi rides
  },
  shared_car: {
    key: "shared_car",
    label: "Shared Car",
    rate: 5,
    additional_rate: 0.5,
    ride: "shared",
    vehicle_type: 5,
    trip_type: 6,
    buffer: 30,
    window: 20,
    capacity: 3,
    occupancy: 3,
    min_occupancy: 2,
    minimum_charge: 60,
  },
  van_shared: {
    key: "van_shared",
    label: "Van",
    rate: 4,
    additional_rate: 0.5, // EGP per km for extra passengers
    ride: "shared",
    vehicle_type: 3,
    trip_type: 4,
    buffer: 45,
    window: 25,
    capacity: 5,
    occupancy: 5,
    min_occupancy: 2,
    minimum_charge: 50, // EGP minimum charge for van rides
  },
  microbus_shared: {
    key: "microbus_shared",
    label: "Microbus",
    rate: 3,
    additional_rate: 0.5, // EGP per km for extra passengers
    ride: "shared",
    vehicle_type: 4,
    trip_type: 5,
    buffer: 45,
    window: 30,
    capacity: 9,
    occupancy: 9,
    min_occupancy: 3,
    minimum_charge: 50, // EGP minimum charge for microbus rides
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

function applyMinimumCharge(
  price: number,
  vehicleType: VehicleKey | "",
  vehiclesMap: Partial<Record<VehicleKey, VehicleConfig>> = VEHICLES,
): number {
  if (!vehicleType) return Math.max(0, Math.round(price));
  const vehicle = vehiclesMap[vehicleType as VehicleKey];
  const normalizedPrice = Math.max(0, Math.round(price));
  return Math.max(vehicle?.minimum_charge ?? 0, normalizedPrice);
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
  if (key === "taxi_shared" || key === "shared_car") return 2;
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
  vehiclesMap: Partial<Record<VehicleKey, VehicleConfig>> = VEHICLES,
): number {
  const n = Math.max(0, extraPassengers);
  const vehicle = vehicleType ? vehiclesMap[vehicleType] : undefined;
  const r = (factor: number) => Math.round(basePrice + basePrice * factor);

  if (vehicle?.ride === "shared") {
    if (vehicleType === "taxi_shared" || vehicleType === "shared_car") {
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

  if (vehicleType === "private_car" || vehicleType === "taxi_private") {
    if (n === 1) return r(0.25);
    if (n === 2) return r(0.5);
    if (n === 3) return r(0.75);
    return basePrice;
  }

  return basePrice;
}

export function computeTripPriceForSelection({
  basePrice,
  distanceKm,
  vehicleType,
  extraPassengers = 0,
  numberOfPassengers,
  selectedDates,
  vehiclesMap = VEHICLES,
}: {
  basePrice?: number;
  distanceKm?: number;
  vehicleType: VehicleKey | "";
  extraPassengers?: number;
  numberOfPassengers?: number;
  selectedDates?: string[];
  vehiclesMap?: Partial<Record<VehicleKey, VehicleConfig>>;
}): number {
  if (!vehicleType) return 0;
  const singleTripPrice = computeTripPriceEgp({
    basePrice,
    distanceKm,
    vehicleType,
    extraPassengers,
    numberOfPassengers,
    vehiclesMap,
  });

  if (!Array.isArray(selectedDates) || selectedDates.length === 0) {
    return singleTripPrice;
  }

  const weekDates = bookingWindow();
  const isFullWeekSelection =
    selectedDates.length === weekDates.length &&
    weekDates.every((day) => selectedDates.includes(day));

  if (!isFullWeekSelection) {
    return singleTripPrice * selectedDates.length;
  }

  const seventhDay = weekDates[weekDates.length - 1];
  return selectedDates.reduce((total, date) => {
    const priceForDate =
      date === seventhDay
        ? Math.round(singleTripPrice * 0.95)
        : singleTripPrice;
    return total + priceForDate;
  }, 0);
}

export interface PrivateFareLeg {
  distanceKm: number;
  passengers: number;
}

export function computeTripPriceEgp({
  basePrice,
  distanceKm,
  vehicleType,
  extraPassengers = 0,
  numberOfPassengers,
  vehiclesMap = VEHICLES,
}: {
  basePrice?: number;
  distanceKm?: number;
  vehicleType: VehicleKey | "";
  extraPassengers?: number;
  numberOfPassengers?: number;
  vehiclesMap?: Partial<Record<VehicleKey, VehicleConfig>>;
}): number {
  if (!vehicleType) return 0;

  const vehicle = vehiclesMap[vehicleType as VehicleKey];
  const normalizedBasePrice =
    typeof basePrice === "number" && Number.isFinite(basePrice)
      ? basePrice
      : typeof distanceKm === "number" && Number.isFinite(distanceKm)
        ? priceFor(
            distanceKm,
            vehicleType as VehicleKey,
            vehiclesMap as Record<VehicleKey, VehicleConfig>,
          )
        : 0;

  const normalizedExtraPassengers = Math.max(
    0,
    Math.round(extraPassengers ?? 0),
  );
  const normalizedNumberOfPassengers =
    typeof numberOfPassengers === "number" &&
    Number.isFinite(numberOfPassengers)
      ? Math.max(1, Math.round(numberOfPassengers))
      : 1;
  const effectiveExtraPassengers =
    vehicle?.ride === "private"
      ? Math.max(0, normalizedNumberOfPassengers - 1)
      : normalizedExtraPassengers;

  return applyMinimumCharge(
    finalPrice(
      normalizedBasePrice,
      effectiveExtraPassengers,
      vehicleType,
      vehiclesMap,
    ),
    vehicleType,
    vehiclesMap,
  );
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
