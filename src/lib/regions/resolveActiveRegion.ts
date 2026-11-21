import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import {
  DEFAULT_REGION,
  getRegionBySlug,
  isRegionCode,
  normalizeRegion,
  REGION_CODES,
  REGIONS,
  type RegionCode,
  type RegionConfig,
} from "@/lib/config/regions";
import { User } from "@/models/User";
import { OperatingCity } from "@/models/OperatingCity";
import {
  capitalCityCode,
  ensureOperatingCitySeed,
} from "@/lib/regions/cities";

export class RegionAccessError extends Error {
  constructor(
    public readonly status: 400 | 403,
    message: string,
  ) {
    super(message);
  }
}

export interface ActiveRegion {
  code: RegionCode;
  config: RegionConfig;
  allowedRegionCodes: RegionCode[];
  cityCode: string;
  city: {
    name: string;
    nameAr: string;
    timezone: string;
    mapCenter: { lat: number; lng: number };
    mapZoom: number;
    active: boolean;
  };
}

function requestedRegion(value: string | null | undefined): RegionCode | null {
  if (!value) return null;
  if (isRegionCode(value)) return value;
  return getRegionBySlug(value)?.code ?? null;
}

export async function resolveActiveRegion({
  userId,
  requested,
  requestedCity,
  allowInactiveCity = false,
}: {
  userId: string;
  requested?: string | null;
  requestedCity?: string | null;
  allowInactiveCity?: boolean;
}): Promise<ActiveRegion> {
  const requestedCode = requestedRegion(requested);
  if (requested && !requestedCode) {
    throw new RegionAccessError(400, "Invalid region.");
  }

  await connectDB();
  const user = await User.findById(userId)
    .select("role region defaultRegionCode defaultCityCode allowedRegionCodes")
    .lean<{
      role?: string;
      region?: unknown;
      defaultRegionCode?: unknown;
      defaultCityCode?: unknown;
      allowedRegionCodes?: unknown;
    }>();
  if (!user) throw new RegionAccessError(403, "Region access denied.");

  const configuredAllowed = Array.isArray(user.allowedRegionCodes)
    ? user.allowedRegionCodes.filter(isRegionCode)
    : [];
  const defaultRegionCode = isRegionCode(user.defaultRegionCode)
    ? user.defaultRegionCode
    : user.region
      ? normalizeRegion(user.region)
      : DEFAULT_REGION;
  // Initial rollout policy: admins without explicit assignments access all
  // active regions. Legacy passengers/drivers without assignments inherit
  // their default region so existing accounts remain usable.
  const allowedRegionCodes =
    user.role === "admin" && configuredAllowed.length === 0
      ? [...REGION_CODES]
      : configuredAllowed.length > 0
        ? configuredAllowed
        : [defaultRegionCode];
  const activeCode = requestedCode ?? defaultRegionCode;
  const effectiveAllowedRegionCodes =
    user.role === "driver" && configuredAllowed.length === 0 && activeCode
      ? [activeCode]
      : allowedRegionCodes;

  if (!activeCode) {
    throw new RegionAccessError(403, "No default region configured.");
  }
  if (!effectiveAllowedRegionCodes.includes(activeCode)) {
    throw new RegionAccessError(403, "Region access denied.");
  }

  if (!(await OperatingCity.exists({ regionCode: activeCode }))) {
    await ensureOperatingCitySeed();
  }
  const requestedCityCode = requestedCity?.trim().toLowerCase() ||
    (typeof user.defaultCityCode === "string" ? user.defaultCityCode : null);
  const savedCity = requestedCityCode
    ? await OperatingCity.findOne({
          regionCode: activeCode,
          cityCode: requestedCityCode,
        }).lean()
    : null;
  if (requestedCity && !savedCity) {
    throw new RegionAccessError(400, "Invalid City/State for this Region.");
  }
  if (savedCity && !savedCity.active && !allowInactiveCity) {
    throw new RegionAccessError(403, "The selected City/State is inactive.");
  }
  const city =
    (savedCity && (savedCity.active || allowInactiveCity) ? savedCity : null) ??
    (await OperatingCity.findOne({
      regionCode: activeCode,
      isCapital: true,
      ...(allowInactiveCity ? {} : { active: true }),
    }).lean());
  if (!city) {
    throw new RegionAccessError(403, "No active City/State is configured.");
  }

  return {
    code: activeCode,
    config: {
      ...REGIONS[activeCode],
      timezone: city.timezone,
      map: {
        ...REGIONS[activeCode].map,
        defaultCenter: city.mapCenter,
        defaultZoom: city.mapZoom,
        bounds: city.bounds ?? REGIONS[activeCode].map.bounds,
      },
    },
    allowedRegionCodes: effectiveAllowedRegionCodes,
    cityCode: city.cityCode || capitalCityCode(activeCode),
    city: {
      name: city.name,
      nameAr: city.nameAr,
      timezone: city.timezone,
      mapCenter: city.mapCenter,
      mapZoom: city.mapZoom,
      active: city.active,
    },
  };
}

export function legacyDefaultRegion(): RegionCode {
  return DEFAULT_REGION;
}
