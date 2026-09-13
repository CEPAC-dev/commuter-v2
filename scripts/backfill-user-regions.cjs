/**
 * Seeds canonical user-region access without removing legacy `region`.
 * Usage: node scripts/backfill-user-regions.cjs --apply
 * Admins without explicit assignments receive all initial regions.
 */
const fs = require("fs");
const { MongoClient } = require("mongodb");

const REGION_CODES = ["EG-CAIRO", "SA", "AE-ABU-DHABI"];
const LEGACY_ALIASES = { EG: "EG-CAIRO", KSA: "SA" };

function loadEnv() {
    if (!fs.existsSync(".env.local")) return;
    for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
}

function canonicalRegion(value) {
    if (REGION_CODES.includes(value)) return value;
    return LEGACY_ALIASES[value] ?? "EG-CAIRO";
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
        const users = client.db(process.env.DB_NAME).collection("users");
        const rows = await users
            .find({})
            .project({ _id: 1, role: 1, region: 1, defaultRegionCode: 1, allowedRegionCodes: 1 })
            .toArray();
        const operations = [];

        for (const user of rows) {
            const existingDefault = REGION_CODES.includes(user.defaultRegionCode)
                ? user.defaultRegionCode
                : null;
            const defaultRegionCode = existingDefault ?? canonicalRegion(user.region);
            const existingAllowed = Array.isArray(user.allowedRegionCodes)
                ? user.allowedRegionCodes.filter((region) => REGION_CODES.includes(region))
                : [];
            const baseAllowed =
                existingAllowed.length > 0
                    ? existingAllowed
                    : user.role === "admin"
                        ? REGION_CODES
                        : [defaultRegionCode];
            const allowedRegionCodes = baseAllowed.includes(defaultRegionCode)
                ? baseAllowed
                : [...baseAllowed, defaultRegionCode];
            const needsDefault = user.defaultRegionCode !== defaultRegionCode;
            const needsAllowed = JSON.stringify(user.allowedRegionCodes ?? []) !== JSON.stringify(allowedRegionCodes);
            if (!needsDefault && !needsAllowed) continue;
            operations.push({
                updateOne: {
                    filter: { _id: user._id },
                    update: { $set: { defaultRegionCode, allowedRegionCodes } },
                },
            });
        }

        const result = operations.length ? await users.bulkWrite(operations, { ordered: true }) : null;
        const unresolved = await users.countDocuments({
            $or: [
                { defaultRegionCode: { $nin: REGION_CODES } },
                { allowedRegionCodes: { $size: 0 } },
            ],
        });
        if (unresolved !== 0) throw new Error(`Migration incomplete: ${unresolved} user(s) lack region access.`);
        console.log(JSON.stringify({
            processed: rows.length,
            matched: result?.matchedCount ?? 0,
            modified: result?.modifiedCount ?? 0,
            unresolved,
        }, null, 2));
    } finally {
        await client.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});