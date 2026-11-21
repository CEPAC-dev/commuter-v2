import type { VehicleConfig, VehicleRegionConfig } from "../config/vehicles.ts";
import {
  CAPITAL_CITY_CODES,
  getCurrencyConfig,
  isRegionKey,
  normalizeRegion,
  type RegionCode,
} from "../config/regions.ts";

export function vehicleForRegion(
  vehicle: VehicleConfig & { regionConfigs?: VehicleRegionConfig[] },
  region: RegionCode,
  cityCode = CAPITAL_CITY_CODES[region],
): VehicleConfig | null {
  const regional = vehicle.regionConfigs?.find(
    (config) =>
      isRegionKey(config.regionCode) &&
      normalizeRegion(config.regionCode) === region &&
      config.cityCode === cityCode,
  );
  const legacyRegional = vehicle.regionConfigs?.find(
    (config) =>
      isRegionKey(config.regionCode) &&
      normalizeRegion(config.regionCode) === region &&
      !config.cityCode,
  );
  // Compatibility during catalog migration: legacy rows store one shared config
  // plus regionCodes. They remain bookable until their regional configs are saved.
  const regionCodes = (vehicle.regionCodes ?? [])
    .filter(isRegionKey)
    .map((code) => normalizeRegion(code));
  if (!regional && !legacyRegional && !regionCodes.includes(region))
    return null;
  const config = regional ?? legacyRegional;
  return {
    ...vehicle,
    ...(config ?? { active: vehicle.active !== false }),
    regionCodes: [region],
    currencyCode: getCurrencyConfig(region).code,
    pricingConfigured: Boolean(config?.pricingConfigured ?? true),
  };
}
