import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import {
  CAPITAL_CITY_CODES,
  REGIONS,
  type RegionCode,
} from "@/lib/config/regions";
import { OperatingCity } from "@/models/OperatingCity";

export const CAPITAL_CITIES: Record<
  RegionCode,
  {
    cityCode: string;
    name: string;
    nameAr: string;
  }
> = {
  EGY: { cityCode: "cairo", name: "Cairo", nameAr: "القاهرة" },
  KSA: { cityCode: "riyadh", name: "Riyadh", nameAr: "الرياض" },
  UAE: {
    cityCode: "abu-dhabi",
    name: "Abu Dhabi",
    nameAr: "أبوظبي",
  },
};

export function capitalCityCode(regionCode: RegionCode) {
  return CAPITAL_CITY_CODES[regionCode];
}

export async function ensureOperatingCitySeed() {
  await connectDB();
  await Promise.all(
    Object.values(REGIONS).map((region) => {
      const capital = CAPITAL_CITIES[region.code];
      return OperatingCity.updateOne(
        { regionCode: region.code, cityCode: capital.cityCode },
        {
          $setOnInsert: {
            regionCode: region.code,
            ...capital,
            isCapital: true,
            active: true,
            timezone: region.timezone,
            mapCenter: region.map.defaultCenter,
            mapZoom: region.map.defaultZoom,
            bounds: region.map.bounds,
          },
        },
        { upsert: true },
      );
    }),
  );
}

export async function getOperatingCities(
  regionCode?: RegionCode,
  includeInactive = false,
) {
  await ensureOperatingCitySeed();
  return OperatingCity.find({
    ...(includeInactive ? {} : { active: true }),
    ...(regionCode ? { regionCode } : {}),
  })
    .sort({ regionCode: 1, isCapital: -1, name: 1 })
    .lean();
}

export async function isOperatingCityInRegion(
  regionCode: RegionCode,
  cityCode: unknown,
) {
  if (typeof cityCode !== "string" || !cityCode.trim()) return false;
  await ensureOperatingCitySeed();
  return Boolean(
    await OperatingCity.exists({
      regionCode,
      cityCode: cityCode.trim().toLowerCase(),
      active: true,
    }),
  );
}
