export type CarType = "passenger_car" | "taxi" | "van" | "microbus" | "minibus";

export interface CarTypeConfig {
  key: CarType;
  label: string;
  capacity: number;
}

export const CAR_TYPES: Record<CarType, CarTypeConfig> = {
  passenger_car: {
    key: "passenger_car",
    label: "Passenger car",
    capacity: 4,
  },
  taxi: { key: "taxi", label: "Taxi", capacity: 4 },
  van: { key: "van", label: "Van", capacity: 6 },
  microbus: { key: "microbus", label: "Microbus", capacity: 10 },
  minibus: { key: "minibus", label: "Minibus", capacity: 14 },
};

export const CAR_TYPE_LIST = Object.values(CAR_TYPES);

const LEGACY_CAR_TYPE_ALIASES: Record<string, CarType> = {
  private: "passenger_car",
};

const COMPATIBLE_VEHICLES: Record<CarType, readonly string[]> = {
  passenger_car: ["private_car", "shared_car"],
  taxi: ["taxi_private", "taxi_shared"],
  van: ["van_shared"],
  microbus: ["microbus_shared"],
  minibus: ["mini_bus"],
};

export function normalizeCarType(value: unknown): CarType | "" {
  if (typeof value !== "string") return "";
  if (Object.prototype.hasOwnProperty.call(CAR_TYPES, value)) {
    return value as CarType;
  }
  return Object.prototype.hasOwnProperty.call(LEGACY_CAR_TYPE_ALIASES, value)
    ? LEGACY_CAR_TYPE_ALIASES[value]
    : "";
}

export function isCarTypeCompatible(
  carType: string | undefined,
  vehicleType: string,
): boolean {
  const normalizedCarType = normalizeCarType(carType);
  return Boolean(
    normalizedCarType &&
    COMPATIBLE_VEHICLES[normalizedCarType]?.includes(vehicleType),
  );
}

/** Server-authoritative capacity for a carType. Never trust client-supplied capacity. */
export function carTypeToCapacity(carType: CarType): number {
  return CAR_TYPES[carType].capacity;
}
