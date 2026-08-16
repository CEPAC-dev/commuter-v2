/**
 * Seed the Vehicle collection from src/lib/config/vehicles.ts (idempotent upsert by key).
 * Run: MONGODB_URI=... node scripts/seed_vehicles.js
 * (or `node -r dotenv/config scripts/seed_vehicles.js dotenv_config_path=.env.local` if dotenv is installed)
 */
const mongoose = require("mongoose");

const VEHICLES = {
  private_car: {
    key: "private_car",
    label: "Private car",
    rate: 15,
    ride: "private",
    buffer: 20,
    window: 10,
    capacity: 4,
    occupancy: 0,
    min_occupancy: 1,
    sortOrder: 0,
  },
  taxi_private: {
    key: "taxi_private",
    label: "Private Taxi",
    rate: 12,
    ride: "private",
    buffer: 20,
    window: 10,
    capacity: 4,
    occupancy: 0,
    min_occupancy: 1,
    sortOrder: 1,
  },
  taxi_shared: {
    key: "taxi_shared",
    label: "Shared Taxi",
    rate: 10,
    ride: "shared",
    buffer: 30,
    window: 20,
    capacity: 4,
    occupancy: 0,
    min_occupancy: 2,
    sortOrder: 2,
  },
  shared_car: {
    key: "shared_car",
    label: "Shared Car",
    rate: 9,
    ride: "shared",
    buffer: 30,
    window: 20,
    capacity: 3,
    occupancy: 3,
    min_occupancy: 2,
    minimum_charge: 60,
    sortOrder: 3,
  },
  van_shared: {
    key: "van_shared",
    label: "Van",
    rate: 7,
    ride: "shared",
    buffer: 45,
    window: 25,
    capacity: 7,
    occupancy: 0,
    min_occupancy: 3,
    sortOrder: 4,
  },
  microbus_shared: {
    key: "microbus_shared",
    label: "Microbus",
    rate: 4,
    ride: "shared",
    buffer: 45,
    window: 30,
    capacity: 14,
    occupancy: 0,
    min_occupancy: 5,
    sortOrder: 5,
  },
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  const VehicleSchema = new mongoose.Schema(
    {
      key: { type: String, required: true, unique: true },
      label: String,
      rate: Number,
      ride: String,
      buffer: Number,
      window: Number,
      capacity: Number,
      occupancy: Number,
      min_occupancy: Number,
      sortOrder: Number,
      active: { type: Boolean, default: true },
    },
    { timestamps: true },
  );
  const Vehicle =
    mongoose.models.Vehicle || mongoose.model("Vehicle", VehicleSchema);

  for (const v of Object.values(VEHICLES)) {
    await Vehicle.updateOne(
      { key: v.key },
      { $setOnInsert: { active: true }, $set: v },
      { upsert: true },
    );
    console.log(`Seeded vehicle: ${v.key}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
