import mongoose from "mongoose";
import { loadEnvConfig } from "@next/env";

const targetKeys = ["shared_car", "taxi_shared"];
const apply = process.argv.slice(2).includes("--apply");
const invalidArgs = process.argv
  .slice(2)
  .filter((argument) => argument !== "--apply");

if (invalidArgs.length > 0) {
  throw new Error(`Unsupported argument: ${invalidArgs[0]}`);
}

loadEnvConfig(process.cwd());
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

try {
  await mongoose.connect(uri, { dbName: process.env.DB_NAME });
  const vehicles = mongoose.connection.db.collection("vehicles");
  const query = { key: { $in: targetKeys } };
  const before = await vehicles
    .find(query, { projection: { key: 1, occupancy: 1 } })
    .sort({ key: 1 })
    .toArray();

  const beforeByKey = new Map(
    before.map((vehicle) => [vehicle.key, vehicle.occupancy ?? null]),
  );
  const changes = targetKeys.map((key) => ({
    key,
    before: beforeByKey.get(key) ?? "not found",
    after: beforeByKey.has(key) ? 3 : "not found",
  }));
  console.log(
    JSON.stringify(
      { mode: apply ? "apply" : "dry-run", changes },
      null,
      2,
    ),
  );

  if (apply) {
    await vehicles.updateMany(query, { $set: { occupancy: 3 } });
    const after = await vehicles
      .find(query, { projection: { key: 1, occupancy: 1 } })
      .sort({ key: 1 })
      .toArray();
    console.log(
      JSON.stringify(
        {
          mode: "after",
          changes: targetKeys.map((key) => ({
            key,
            before: beforeByKey.get(key) ?? "not found",
            after:
              after.find((vehicle) => vehicle.key === key)?.occupancy ??
              "not found",
          })),
        },
        null,
        2,
      ),
    );
  }
} finally {
  await mongoose.disconnect();
}
