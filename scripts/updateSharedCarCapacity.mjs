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
    .find(query, {
      projection: { key: 1, occupancy: 1, regionConfigs: 1 },
    })
    .sort({ key: 1 })
    .toArray();

  const beforeByKey = new Map(
    before.map((vehicle) => [vehicle.key, vehicle.occupancy ?? null]),
  );
  const changes = targetKeys.map((key) => ({
    key,
    before:
      beforeByKey.get(key) === undefined
        ? "not found"
        : {
            occupancy: beforeByKey.get(key),
            regionConfigs: before
              .find((vehicle) => vehicle.key === key)
              ?.regionConfigs?.map((config) => ({
                regionCode: config.regionCode,
                occupancy: config.occupancy ?? null,
              })),
          },
    after:
      beforeByKey.has(key)
        ? {
            occupancy: 3,
            regionConfigs: before
              .find((vehicle) => vehicle.key === key)
              ?.regionConfigs?.map((config) => ({
                regionCode: config.regionCode,
                occupancy: 3,
              })),
          }
        : "not found",
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
    await vehicles.updateMany(
      { ...query, regionConfigs: { $type: "array" } },
      { $set: { "regionConfigs.$[region].occupancy": 3 } },
      { arrayFilters: [{ "region.occupancy": { $ne: 3 } }] },
    );
    const after = await vehicles
      .find(query, {
        projection: { key: 1, occupancy: 1, regionConfigs: 1 },
      })
      .sort({ key: 1 })
      .toArray();
    console.log(
      JSON.stringify(
        {
          mode: "after",
          changes: targetKeys.map((key) => ({
            key,
            before: changes.find((change) => change.key === key)?.before,
            after: after.find((vehicle) => vehicle.key === key)
              ? {
                  occupancy: after.find((vehicle) => vehicle.key === key)
                    ?.occupancy,
                  regionConfigs: after
                    .find((vehicle) => vehicle.key === key)
                    ?.regionConfigs?.map((config) => ({
                      regionCode: config.regionCode,
                      occupancy: config.occupancy ?? null,
                    })),
                }
              : "not found",
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
