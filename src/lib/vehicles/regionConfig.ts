import type { VehicleConfig, VehicleRegionConfig } from "@/lib/config/vehicles";
import { getCurrencyConfig, type RegionCode } from "@/lib/config/regions";

export function vehicleForRegion(
  vehicle: VehicleConfig & { regionConfigs?: VehicleRegionConfig[] },
  region: RegionCode,
): VehicleConfig | null {
  const regional = vehicle.regionConfigs?.find((config) => config.regionCode === region);
  // Compatibility during catalog migration: legacy rows store one shared config
  // plus regionCodes. They remain bookable until their regional configs are saved.
  if (!regional && !vehicle.regionCodes?.includes(region)) return null;
  return {
    ...vehicle,
    ...(regional ?? {}),
    regionCodes: [region],
    currencyCode: getCurrencyConfig(region).code,
  };
}
