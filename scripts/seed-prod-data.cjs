/**
 * Copy users, drivers, and stations from one MongoDB database to another.
 *
 * Usage:
 *   node scripts/seed-prod-data.cjs
 *
 * Environment variables:
 *   SOURCE_MONGODB_URI / TARGET_MONGODB_URI
 *   SOURCE_DB_NAME / TARGET_DB_NAME
 *   MONGODB_URI / DB_NAME (fallback if only one DB is provided)
 *
 * Notes:
 *   - The target collections are cleared first, then repopulated.
 *   - The script preserves the source documents as-is for users/drivers/stations.
 *   - For users and drivers, unique indexes are recreated on the target.
 */

try {
    require("dotenv").config({ path: ".env.local" });
} catch {
    // dotenv not installed — fall back to a minimal manual .env.local parser
    const fs = require("fs");
    if (fs.existsSync(".env.local")) {
        for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
            const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
            if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
        }
    }
}

const { MongoClient } = require("mongodb");

function resolveConfig(env = process.env) {
    const sourceUri = env.SOURCE_MONGODB_URI || env.MONGODB_URI;
    const targetUri = env.TARGET_MONGODB_URI || env.MONGODB_URI;
    const sourceDbName = env.SOURCE_DB_NAME || env.DB_NAME;
    const targetDbName = env.TARGET_DB_NAME || env.DB_NAME;

    if (!sourceUri) {
        throw new Error("SOURCE_MONGODB_URI or MONGODB_URI is required");
    }

    if (!targetUri) {
        throw new Error("TARGET_MONGODB_URI or MONGODB_URI is required");
    }

    if (!sourceDbName) {
        throw new Error("SOURCE_DB_NAME or DB_NAME is required");
    }

    if (!targetDbName) {
        throw new Error("TARGET_DB_NAME or DB_NAME is required");
    }

    return { sourceUri, targetUri, sourceDbName, targetDbName };
}

async function ensureIndexes(targetDb, collectionName) {
    const collection = targetDb.collection(collectionName);

    if (collectionName === "users") {
        await collection.createIndex({ phone: 1, role: 1 }, { unique: true });
        await collection.createIndex(
            { email: 1, role: 1 },
            { unique: true, partialFilterExpression: { email: { $type: "string" } } },
        );
    }

    if (collectionName === "drivers") {
        await collection.createIndex({ userId: 1 }, { unique: true });
    }

    if (collectionName === "stations") {
        await collection.createIndex({ objectId: 1 }, { unique: true });
        await collection.createIndex({ lat: 1, lng: 1 });
    }
}

async function copyCollection(sourceDb, targetDb, collectionName) {
    const sourceCollection = sourceDb.collection(collectionName);
    const targetCollection = targetDb.collection(collectionName);

    const sourceDocs = await sourceCollection.find({}).toArray();
    await targetCollection.deleteMany({});

    if (sourceDocs.length === 0) {
        console.log(`No documents found in ${collectionName}; skipped.`);
        return sourceDocs.length;
    }

    await targetCollection.insertMany(sourceDocs);
    await ensureIndexes(targetDb, collectionName);
    return sourceDocs.length;
}

async function main() {
    const config = resolveConfig();
    console.log(`Copying users, drivers, and stations from ${config.sourceDbName} to ${config.targetDbName}...`);

    const sourceClient = new MongoClient(config.sourceUri);
    const targetClient = new MongoClient(config.targetUri);

    try {
        await sourceClient.connect();
        await targetClient.connect();

        const sourceDb = sourceClient.db(config.sourceDbName);
        const targetDb = targetClient.db(config.targetDbName);

        const counts = {};
        for (const collectionName of ["users", "drivers", "stations"]) {
            const count = await copyCollection(sourceDb, targetDb, collectionName);
            counts[collectionName] = count;
        }

        console.log("Migration complete:");
        for (const [name, count] of Object.entries(counts)) {
            console.log(`- ${name}: ${count} documents`);
        }
    } finally {
        await sourceClient.close();
        await targetClient.close();
    }
}

module.exports = { resolveConfig };

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
