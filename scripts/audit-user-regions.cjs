/**
 * Read-only audit before defaultRegionCode/allowedRegionCodes user backfill.
 * Usage: node scripts/audit-user-regions.cjs
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
    loadEnv();
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    try {
        const users = client.db(process.env.DB_NAME).collection("users");
        const rows = await users
            .aggregate([
                {
                    $group: {
                        _id: { role: "$role", region: "$region" },
                        count: { $sum: 1 },
                        usersWithPermissions: {
                            $sum: {
                                $cond: [{ $gt: [{ $size: { $ifNull: ["$permissions", []] } }, 0] }, 1, 0],
                            },
                        },
                        usersWithDefaultRegion: {
                            $sum: { $cond: [{ $ne: [{ $ifNull: ["$defaultRegionCode", null] }, null] }, 1, 0] },
                        },
                        usersWithAllowedRegions: {
                            $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ["$allowedRegionCodes", []] } }, 0] }, 1, 0] },
                        },
                    },
                },
                { $sort: { "_id.role": 1, "_id.region": 1 } },
            ])
            .toArray();
        const invalidLegacyRegions = await users
            .find({ region: { $nin: ["EG", "KSA", "EG-CAIRO", "SA", "AE-ABU-DHABI", null] } })
            .project({ _id: 1, role: 1, region: 1 })
            .toArray();
        const invalidAllowedRegions = await users
            .find({ allowedRegionCodes: { $elemMatch: { $nin: ["EG-CAIRO", "SA", "AE-ABU-DHABI"] } } })
            .project({ _id: 1, role: 1, allowedRegionCodes: 1 })
            .toArray();

        console.log(JSON.stringify({
            generatedAt: new Date().toISOString(),
            readOnly: true,
            totalUsers: await users.countDocuments(),
            groups: rows,
            invalidLegacyRegions,
            invalidAllowedRegions,
        }, null, 2));
    } finally {
        await client.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});