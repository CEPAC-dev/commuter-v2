import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { VEHICLE_LIST } from "@/lib/config/vehicles";
import { REGION_CODES, VEHICLE_REGIONS } from "@/lib/config/regions";
import { Vehicle } from "@/models/Vehicle";
import { VehicleCatalogState } from "@/models/VehicleCatalogState";

/** One-time-compatible seed. Existing admin edits are never overwritten. */
export async function ensureVehicleSeed() {
  await connectDB();
  const seeded = await VehicleCatalogState.exists({ key: "default-v1" });
  if (!seeded) await Promise.all(
    VEHICLE_LIST.map((vehicle, sortOrder) => {
      const regions = VEHICLE_REGIONS[vehicle.key];
      return Vehicle.updateOne(
        { key: vehicle.key },
        {
          $setOnInsert: {
            ...vehicle,
            regionCodes: regions === "all" ? [...REGION_CODES] : (regions ?? []),
            regionConfigs: (regions === "all" ? REGION_CODES : (regions ?? [])).map((regionCode) => ({ ...vehicle, regionCode, sortOrder })),
            sortOrder,
            active: true,
          },
        },
        { upsert: true },
      );
    }),
  );
  if (!seeded) await VehicleCatalogState.updateOne(
    { key: "default-v1" },
    { $setOnInsert: { key: "default-v1" } },
    { upsert: true },
  );
  // Upgrade catalog made before regional config support without changing values.
  const legacyVehicles = await Vehicle.find({ $or: [{ regionConfigs: { $exists: false } }, { regionConfigs: { $size: 0 } }] }).lean();
  await Promise.all(legacyVehicles.map((vehicle) => {
    const regions = vehicle.regionCodes ?? [];
    return Vehicle.updateOne({ _id: vehicle._id }, { $set: { regionConfigs: regions.map((regionCode: string) => ({ regionCode, rate: vehicle.rate, additional_rate: vehicle.additional_rate ?? 0, buffer: vehicle.buffer, window: vehicle.window, capacity: vehicle.capacity, occupancy: vehicle.occupancy, min_occupancy: vehicle.min_occupancy, minimum_charge: vehicle.minimum_charge ?? 0, vehicle_type: vehicle.vehicle_type ?? 0, trip_type: vehicle.trip_type ?? 0, sortOrder: vehicle.sortOrder ?? 0 })) } });
  }));
}
