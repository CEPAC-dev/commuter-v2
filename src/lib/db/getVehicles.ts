import "server-only";
import { Vehicle } from "@/models/Vehicle";
import { ensureVehicleSeed } from "@/lib/db/seedVehicles";
import { vehicleForRegion } from "@/lib/vehicles/regionConfig";
import type { RegionCode } from "@/lib/config/regions";
import {
  VEHICLES,
  type VehicleConfig,
} from "@/lib/config/vehicles";

const TTL_MS = 60_000;
let cache: {
  map: Record<string, VehicleConfig>;
  expiresAt: number;
} | null = null;

export function invalidateVehiclesCache() {
  cache = null;
}

/** DB-authoritative vehicle config map, cached briefly, falls back to the static seed. */
export async function getVehicles(region?: RegionCode): Promise<Record<string, VehicleConfig>> {
  if (!region && cache && cache.expiresAt > Date.now()) return cache.map;

  try {
    await ensureVehicleSeed();
    const docs = await Vehicle.find({ active: true }).lean<(VehicleConfig & { key: string })[]>();

    const map: Record<string, VehicleConfig> = {};
    for (const d of docs) {
      const scoped = region ? vehicleForRegion(d, region) : d;
      if (!scoped) continue;
      const fallback = VEHICLES[scoped.key];
      map[scoped.key] = {
        key: scoped.key,
        label: scoped.label,
        rate: scoped.rate,
        additional_rate: scoped.additional_rate ?? fallback?.additional_rate ?? 0,
        ride: scoped.ride,
        vehicle_type: scoped.vehicle_type ?? fallback?.vehicle_type ?? 0,
        trip_type: scoped.trip_type ?? fallback?.trip_type ?? 0,
        buffer: scoped.buffer,
        window: scoped.window,
        capacity: scoped.capacity,
        occupancy: scoped.occupancy,
        min_occupancy: scoped.min_occupancy,
        minimum_charge: scoped.minimum_charge ?? fallback?.minimum_charge ?? 0,
        regionCodes: scoped.regionCodes ?? [],
        active: true,
        sortOrder: d.sortOrder ?? 0,
      };
    }
    if (!region) cache = { map, expiresAt: Date.now() + TTL_MS };
    return map;
  } catch {
    return VEHICLES;
  }
}
