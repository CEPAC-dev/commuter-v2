export type CarType = "private" | "taxi" | "van" | "microbus";

export interface CarTypeConfig {
  key: CarType;
  label: string;
  capacity: number;
}

export const CAR_TYPES: Record<CarType, CarTypeConfig> = {
  private: { key: "private", label: "Private", capacity: 4 },
  taxi: { key: "taxi", label: "Taxi", capacity: 4 },
  van: { key: "van", label: "Van", capacity: 6 },
  microbus: { key: "microbus", label: "Microbus", capacity: 10 },
};

export const CAR_TYPE_LIST = Object.values(CAR_TYPES);

/** Server-authoritative capacity for a carType. Never trust client-supplied capacity. */
export function carTypeToCapacity(carType: CarType): number {
  return CAR_TYPES[carType].capacity;
}
