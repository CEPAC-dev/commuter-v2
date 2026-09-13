/**
 * Read-only pre-migration audit for region-scoping existing stations.
 * Usage: node scripts/audit-station-regions.cjs
 * Requires MONGODB_URI and optional DB_NAME in .env.local or environment.
 */
try {
    require("dotenv").config({ path: ".env.local" });
} catch {
    const fs = require("fs");
    if (fs.existsSync(".env.local")) {
        for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
            if (match && !process.env[match[1]]) {
                process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
            }
        }
    }
}

const { MongoClient } = require("mongodb");

// Conservative operational bounds for Greater Cairo. Records outside require review.
const GREATER_CAIRO = { minLat: 29.5, maxLat: 30.45, minLng: 30.75, maxLng: 31.75 };

function isCoordinate(value, min, max) {
    return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function inGreaterCairo(station) {
    return (
        isCoordinate(station.lat, GREATER_CAIRO.minLat, GREATER_CAIRO.maxLat) &&
        isCoordinate(station.lng, GREATER_CAIRO.minLng, GREATER_CAIRO.maxLng)
    );
}

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");

    const client = new MongoClient(uri);
    await client.connect();
    try {
        const db = client.db(process.env.DB_NAME);
        const stations = await db.collection("stations").find({}).toArray();
        const objectIdCounts = new Map();
        const invalidCoordinates = [];
        const missingRequiredFields = [];
        const outsideGreaterCairo = [];
        const geographicDistribution = new Map();

        for (const station of stations) {
            const key = String(station.objectId);
            objectIdCounts.set(key, (objectIdCounts.get(key) ?? 0) + 1);

            if (!isCoordinate(station.lat, -90, 90) || !isCoordinate(station.lng, -180, 180)) {
                invalidCoordinates.push({ _id: String(station._id), objectId: station.objectId, lat: station.lat, lng: station.lng });
            }
            const missing = ["objectId", "lat", "lng"].filter(
                (field) => station[field] === undefined || station[field] === null || station[field] === "",
            );
            if (missing.length) {
                missingRequiredFields.push({ _id: String(station._id), objectId: station.objectId, missing });
            }
            if (!inGreaterCairo(station)) {
                outsideGreaterCairo.push({ _id: String(station._id), objectId: station.objectId, lat: station.lat, lng: station.lng, name: station.name ?? "" });
            }
            if (isCoordinate(station.lat, -90, 90) && isCoordinate(station.lng, -180, 180)) {
                const bucket = `${Math.floor(station.lat)}:${Math.floor(station.lng)}`;
                geographicDistribution.set(bucket, (geographicDistribution.get(bucket) ?? 0) + 1);
            }
        }

        const duplicateObjectIds = [...objectIdCounts]
            .filter(([, count]) => count > 1)
            .map(([objectId, count]) => ({ objectId: Number(objectId), count }));
        const [tripReferences, rideReferences, availabilityReferences] = await Promise.all([
            db.collection("trips").countDocuments({
                $or: [
                    { pickupStation: { $exists: true, $ne: null } },
                    { dropoffStation: { $exists: true, $ne: null } },
                ],
            }),
            db.collection("rides").countDocuments({
                $or: [
                    { pickupStation: { $exists: true, $ne: null } },
                    { dropoffStation: { $exists: true, $ne: null } },
                    { "passengers.pickupStation": { $exists: true } },
                    { "passengers.dropoffStation": { $exists: true } },
                ],
            }),
            db.collection("availabilities").countDocuments({
                startNearestStation: { $exists: true, $ne: null },
            }),
        ]);

        const report = {
            generatedAt: new Date().toISOString(),
            readOnly: true,
            greaterCairoBounds: GREATER_CAIRO,
            totals: {
                stations: stations.length,
                active: stations.filter((station) => station.active !== false).length,
                inactive: stations.filter((station) => station.active === false).length,
            },
            invalidCoordinates,
            duplicateObjectIds,
            missingRequiredFields,
            outsideGreaterCairo,
            geographicDistribution: Object.fromEntries([...geographicDistribution].sort()),
            existingStationReferences: {
                trips: tripReferences,
                rides: rideReferences,
                availabilities: availabilityReferences,
            },
            eligibleForAutomaticEgCairoBackfill:
                invalidCoordinates.length === 0 &&
                missingRequiredFields.length === 0 &&
                duplicateObjectIds.length === 0 &&
                outsideGreaterCairo.length === 0,
        };

        console.log(JSON.stringify(report, null, 2));
    } finally {
        await client.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});