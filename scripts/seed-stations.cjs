/**
 * One-time seed: loads public/geo/PT910ExcelToTab_FeaturesToJSO3.geojson into the
 * `stations` collection. Safe to re-run — it replaces existing station points.
 *
 * Usage: node scripts/seed-stations.cjs
 * Requires MONGODB_URI (and optional DB_NAME) in the environment / .env.local.
 */
try {
    require("dotenv").config({ path: ".env.local" });
} catch {
    // dotenv not installed — fall back to a minimal manual .env.local parser
    const fs = require("fs");
    if (fs.existsSync(".env.local")) {
        for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
            const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
            if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
    }
}
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");

    const filePath = path.join(
        process.cwd(),
        "public",
        "geo",
        "PT910ExcelToTab_FeaturesToJSO3.geojson",
    );
    const geojson = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
        throw new Error("Invalid GeoJSON FeatureCollection");
    }

    const docs = geojson.features.map((f) => {
        const [lng, lat] = f.geometry.coordinates;
        return {
            objectId: f.properties?.OBJECTID ?? f.id,
            name: String(f.properties?.name ?? ""),
            direction: String(f.properties?.direction ?? ""),
            landmark: String(f.properties?.landmark ?? ""),
            stationType: String(f.properties?.station_type ?? ""),
            lat,
            lng,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    });

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const col = db.collection("stations");

    await col.deleteMany({});
    await col.insertMany(docs);
    await col.createIndex({ objectId: 1 }, { unique: true });
    await col.createIndex({ lat: 1, lng: 1 });

    console.log(`Seeded ${docs.length} station points.`);
    await client.close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
