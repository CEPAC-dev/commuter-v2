import type { VehicleConfig, VehicleKey } from "@/lib/config/vehicles";

export const REGION_CODES = ["EG-CAIRO", "SA", "AE-ABU-DHABI"] as const;
export type RegionCode = (typeof REGION_CODES)[number];

export const REGION_SLUGS = ["eg", "sa", "ae"] as const;
export type RegionSlug = (typeof REGION_SLUGS)[number];

export const LEGACY_REGION_CODES = ["EG", "KSA"] as const;
export type LegacyRegionCode = (typeof LEGACY_REGION_CODES)[number];

/** Temporary compatibility type for persisted pre-migration User.region values. */
export type RegionKey = RegionCode | LegacyRegionCode;

export interface RegionBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface RegionConfig {
  code: RegionCode;
  urlSlug: RegionSlug;
  label: string;
  labelAr: string;
  countryCode: "EG" | "SA" | "AE";
  currency: {
    code: "EGP" | "SAR" | "AED";
    locale: string;
    decimalDigits: number;
  };
  phonePrefix: string;
  map: {
    provider: "google" | "osm";
    defaultCenter: { lat: number; lng: number };
    defaultZoom: number;
    bounds?: RegionBounds;
  };
  timezone: string;
  isActive: boolean;
}

export const REGIONS: Record<RegionCode, RegionConfig> = {
  "EG-CAIRO": {
    code: "EG-CAIRO",
    urlSlug: "eg",
    label: "Egypt - Greater Cairo",
    labelAr: "مصر",
    countryCode: "EG",
    currency: { code: "EGP", locale: "en-EG", decimalDigits: 2 },
    phonePrefix: "+20",
    map: {
      provider: "google",
      defaultCenter: { lat: 30.0444, lng: 31.2357 },
      defaultZoom: 11,
      // Legacy Egypt bounds retained for location suggestion only, not station migration.
      bounds: { minLat: 21.5, maxLat: 32.0, minLng: 24.5, maxLng: 35.0 },
    },
    timezone: "Africa/Cairo",
    isActive: true,
  },
  SA: {
    code: "SA",
    urlSlug: "sa",
    label: "Saudi Arabia",
    labelAr: "السعودية",
    countryCode: "SA",
    currency: { code: "SAR", locale: "en-SA", decimalDigits: 2 },
    phonePrefix: "+966",
    map: {
      provider: "google",
      defaultCenter: { lat: 24.7136, lng: 46.6753 },
      defaultZoom: 11,
      bounds: { minLat: 15.5, maxLat: 32.5, minLng: 34.4, maxLng: 56.0 },
    },
    timezone: "Asia/Riyadh",
    isActive: true,
  },
  "AE-ABU-DHABI": {
    code: "AE-ABU-DHABI",
    urlSlug: "ae",
    label: "UAE - Abu Dhabi",
    labelAr: "الإمارات - أبوظبي",
    countryCode: "AE",
    currency: { code: "AED", locale: "en-AE", decimalDigits: 2 },
    phonePrefix: "+971",
    map: {
      provider: "google",
      defaultCenter: { lat: 24.4539, lng: 54.3773 },
      defaultZoom: 11,
    },
    timezone: "Asia/Dubai",
    isActive: true,
  },
};

export const LEGACY_REGION_ALIASES: Record<LegacyRegionCode, RegionCode> = {
  EG: "EG-CAIRO",
  KSA: "SA",
};

export const REGION_LIST = Object.values(REGIONS);
export const DEFAULT_REGION: RegionCode = "EG-CAIRO";

/** Which regions each vehicle type is offered in ("all" = every region). */
export const VEHICLE_REGIONS: Record<VehicleKey, RegionCode[] | "all"> = {
  private_car: ["EG-CAIRO", "SA"],
  taxi_private: "all",
  taxi_shared: "all",
  shared_car: ["EG-CAIRO", "SA"],
  van_shared: ["SA"],
  microbus_shared: ["SA", "AE-ABU-DHABI"],
  mini_bus: ["AE-ABU-DHABI"],
};

export function isRegionCode(value: unknown): value is RegionCode {
  return (
    typeof value === "string" && REGION_CODES.includes(value as RegionCode)
  );
}

export function isRegionKey(value: unknown): value is RegionKey {
  return (
    isRegionCode(value) ||
    (typeof value === "string" &&
      LEGACY_REGION_CODES.includes(value as LegacyRegionCode))
  );
}

export function normalizeRegion(value: unknown): RegionCode {
  if (isRegionCode(value)) return value;
  if (typeof value === "string" && value in LEGACY_REGION_ALIASES) {
    return LEGACY_REGION_ALIASES[value as LegacyRegionCode];
  }
  return DEFAULT_REGION;
}

export function getRegionConfig(value: unknown): RegionConfig | null {
  if (!isRegionCode(value)) return null;
  return REGIONS[value];
}

export function getRegionBySlug(value: unknown): RegionConfig | null {
  if (typeof value !== "string") return null;
  return REGION_LIST.find((region) => region.urlSlug === value) ?? null;
}

export function getMapConfig(value: unknown): RegionConfig["map"] {
  return REGIONS[normalizeRegion(value)].map;
}

export function getCurrencyConfig(value: unknown): RegionConfig["currency"] {
  return REGIONS[normalizeRegion(value)].currency;
}

export function isVehicleAvailableInRegion(
  key: string,
  region: RegionCode,
): boolean {
  const allowed = VEHICLE_REGIONS[key as VehicleKey];
  if (!allowed) return false;
  return allowed === "all" || allowed.includes(region);
}

export function vehicleKeysForRegion(region: RegionCode): VehicleKey[] {
  return (Object.keys(VEHICLE_REGIONS) as VehicleKey[]).filter((key) =>
    isVehicleAvailableInRegion(key, region),
  );
}

export function vehiclesForRegion<T extends Pick<VehicleConfig, "key">>(
  list: T[],
  region: RegionCode,
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
): RegionCode | null {
  for (const region of REGION_LIST) {
    if (!region.map.bounds) continue;
    const { minLat, maxLat, minLng, maxLng } = region.map.bounds;
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      return region.code;
    }
  }
  return null;
}
