import type { VehicleConfig, VehicleKey } from "@/lib/config/vehicles";

export const REGION_KEYS = ["EG", "SA"] as const;
export type RegionKey = (typeof REGION_KEYS)[number];

export interface RegionBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface RegionConfig {
  key: RegionKey;
  label: string;
  labelAr: string;
  countryCode: string;
  currency: string;
  phonePrefix: string;
  center: { lat: number; lng: number };
  bounds: RegionBounds;
}

export const REGIONS: Record<RegionKey, RegionConfig> = {
  EG: {
    key: "EG",
    label: "Egypt",
    labelAr: "مصر",
    countryCode: "EG",
    currency: "EGP",
    phonePrefix: "+20",
    center: { lat: 30.0444, lng: 31.2357 },
    bounds: { minLat: 21.5, maxLat: 32.0, minLng: 24.5, maxLng: 35.0 },
  },
  SA: {
    key: "SA",
    label: "Saudi Arabia",
    labelAr: "السعودية",
    countryCode: "SA",
    currency: "SAR",
    phonePrefix: "+966",
    center: { lat: 24.7136, lng: 46.6753 },
    bounds: { minLat: 15.5, maxLat: 32.5, minLng: 34.4, maxLng: 56.0 },
  },
};

export const REGION_LIST = Object.values(REGIONS);
export const DEFAULT_REGION: RegionKey = "EG";

/** Which regions each vehicle type is offered in ("all" = every region). */
export const VEHICLE_REGIONS: Record<VehicleKey, RegionKey[] | "all"> = {
  private_car: "all",
  taxi_private: "all",
  taxi_shared: "all",
  shared_car: ["SA"],
  van_shared: ["EG"],
  microbus_shared: ["EG"],
};

export function isRegionKey(value: unknown): value is RegionKey {
  return (
    typeof value === "string" && REGION_KEYS.includes(value as RegionKey)
  );
}

export function normalizeRegion(value: unknown): RegionKey {
  return isRegionKey(value) ? value : DEFAULT_REGION;
}

export function isVehicleAvailableInRegion(
  key: string,
  region: RegionKey,
): boolean {
  const allowed = VEHICLE_REGIONS[key as VehicleKey];
  if (!allowed) return false;
  return allowed === "all" || allowed.includes(region);
}

export function vehicleKeysForRegion(region: RegionKey): VehicleKey[] {
  return (Object.keys(VEHICLE_REGIONS) as VehicleKey[]).filter((key) =>
    isVehicleAvailableInRegion(key, region),
  );
}

export function vehiclesForRegion<T extends Pick<VehicleConfig, "key">>(
  list: T[],
  region: RegionKey,
): T[] {
  return list.filter((vehicle) =>
    isVehicleAvailableInRegion(vehicle.key, region),
  );
}

/**
 * Region for a geolocation fix. Egypt wins the narrow Gulf-of-Aqaba overlap.
 */
export function regionFromCoordinates(
  lat: number,
  lng: number,
): RegionKey | null {
  for (const region of [REGIONS.EG, REGIONS.SA]) {
    const { minLat, maxLat, minLng, maxLng } = region.bounds;
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      return region.key;
    }
  }
  return null;
}
