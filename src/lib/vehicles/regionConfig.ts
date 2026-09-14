import type { VehicleConfig, VehicleRegionConfig } from "@/lib/config/vehicles";
import { getCurrencyConfig, type RegionCode } from "@/lib/config/regions";

export function vehicleForRegion(
  vehicle: VehicleConfig & { regionConfigs?: VehicleRegionConfig[] },
  region: RegionCode,
): VehicleConfig | null {
  const regional = vehicle.regionConfigs?.find((config) => config.regionCode === region);
  if (!regional) return null;
  return { ...vehicle, ...regional, regionCodes: [region], currencyCode: getCurrencyConfig(region).code };
}
