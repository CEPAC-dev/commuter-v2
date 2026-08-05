import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";
import {
  VEHICLES,
  type VehicleConfig,
  type VehicleKey,
} from "@/lib/config/vehicles";

const TTL_MS = 60_000;
let cache: {
  map: Record<VehicleKey, VehicleConfig>;
  expiresAt: number;
} | null = null;

/** DB-authoritative vehicle config map, cached briefly, falls back to the static seed. */
export async function getVehicles(): Promise<
  Record<VehicleKey, VehicleConfig>
> {
  if (cache && cache.expiresAt > Date.now()) return cache.map;

  try {
    await connectDB();
    const docs = await Vehicle.find({ active: true }).lean<
      (VehicleConfig & { key: VehicleKey })[]
    >();
    if (!docs.length) return VEHICLES;

    const map = { ...VEHICLES };
    for (const d of docs) {
      const fallback = VEHICLES[d.key];
      map[d.key] = {
        key: d.key,
        label: d.label,
        rate: d.rate,
        ride: fallback?.ride ?? d.ride,
        buffer: d.buffer,
        window: d.window,
        capacity: d.capacity,
        occupancy: d.occupancy,
        min_occupancy: d.min_occupancy,
        minimum_charge: d.minimum_charge ?? fallback?.minimum_charge ?? 0,
      };
    }
    cache = { map, expiresAt: Date.now() + TTL_MS };
    return map;
  } catch {
    return VEHICLES;
  }
}
