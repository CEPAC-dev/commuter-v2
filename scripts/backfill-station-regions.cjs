/**
 * Assigns unassigned legacy stations to approved EG-CAIRO scope.
 * Usage: node scripts/backfill-station-regions.cjs --apply
 * Idempotent: only documents without regionCode change. No indexes change.
 */
const fs = require("fs");
const { MongoClient } = require("mongodb");

function loadEnv() {
    if (!fs.existsSync(".env.local")) return;
    for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
}

async function main() {
    if (!process.argv.includes("--apply")) {
        throw new Error("Dry-run only. Re-run with --apply after reviewing this script.");
    }
    loadEnv();
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    try {
        const db = client.db(process.env.DB_NAME);
        const stations = db.collection("stations");
        const filter = { $or: [{ regionCode: { $exists: false } }, { regionCode: null }] };
        const before = await stations.countDocuments(filter);
        const result = await stations.updateMany(filter, { $set: { regionCode: "EG-CAIRO" } });
        const remaining = await stations.countDocuments(filter);
        if (remaining !== 0) throw new Error(`Backfill incomplete: ${remaining} station(s) remain unassigned.`);
        console.log(JSON.stringify({ approvedScope: "EG-CAIRO", matched: before, modified: result.modifiedCount, remaining }, null, 2));
    } finally {
        await client.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});