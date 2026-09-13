/*
 * Read-only audit before adding regionCode to historical operational records.
 * Usage: node scripts/audit-operational-regions.cjs
 */
const fs = require("fs");
const { MongoClient } = require("mongodb");

const REGIONS = ["EG-CAIRO", "SA", "AE-ABU-DHABI"];

function loadEnv() {
    if (!fs.existsSync(".env.local")) return;
    for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
}

async function summarize(collection) {
    const [total, missing, invalid, byRegion] = await Promise.all([
        collection.countDocuments(),
        collection.countDocuments({ regionCode: { $in: [null, ""] } }),
        collection.countDocuments({ regionCode: { $nin: [...REGIONS, null, ""] } }),
        collection.aggregate([
            { $group: { _id: { $ifNull: ["$regionCode", null] }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]).toArray(),
    ]);
    return { total, missing, invalid, byRegion };
}

async function countResolvableByUser(collection, userField) {
    const rows = await collection.aggregate([
        { $match: { regionCode: { $in: [null, ""] } } },
        { $lookup: { from: "users", localField: userField, foreignField: "_id", as: "user" } },
        { $set: { user: { $first: "$user" } } },
        {
            $set: {
                inferredRegion: {
                    $ifNull: [
                        "$user.defaultRegionCode",
                        { $switch: { branches: [
                            { case: { $eq: ["$user.region", "EG"] }, then: "EG-CAIRO" },
                            { case: { $eq: ["$user.region", "KSA"] }, then: "SA" },
                            { case: { $in: ["$user.region", REGIONS] }, then: "$user.region" },
                        ], default: null } },
                    ],
                },
            },
        },
        { $group: { _id: "$inferredRegion", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]).toArray();
    return rows;
}

async function main() {
    loadEnv();
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    try {
        const db = client.db(process.env.DB_NAME);
        const requests = db.collection("requests");
        const trips = db.collection("trips");
        const rides = db.collection("rides");
        const availability = db.collection("availabilities");

        const [requestSummary, tripSummary, rideSummary, availabilitySummary] = await Promise.all([
            summarize(requests),
            summarize(trips),
            summarize(rides),
            summarize(availability),
        ]);
        const [requestsResolvable, tripsResolvable, ridesResolvable, availabilityResolvable] = await Promise.all([
            countResolvableByUser(requests, "userId"),
            countResolvableByUser(trips, "userId"),
            countResolvableByUser(rides, "driverId"),
            countResolvableByUser(availability, "driverId"),
        ]);
        const requestTripConflicts = await trips.aggregate([
            { $match: { regionCode: { $in: REGIONS } } },
            { $lookup: { from: "requests", localField: "requestId", foreignField: "_id", as: "request" } },
            { $set: { request: { $first: "$request" } } },
            { $match: { "request.regionCode": { $in: REGIONS }, $expr: { $ne: ["$regionCode", "$request.regionCode"] } } },
            { $count: "count" },
        ]).toArray();

        console.log(JSON.stringify({
            generatedAt: new Date().toISOString(),
            readOnly: true,
            collections: {
                requests: { ...requestSummary, missingResolvableByUser: requestsResolvable },
                trips: { ...tripSummary, missingResolvableByUser: tripsResolvable },
                rides: { ...rideSummary, missingResolvableByDriver: ridesResolvable },
                availability: { ...availabilitySummary, missingResolvableByUser: availabilityResolvable },
            },
            requestTripRegionConflicts: requestTripConflicts[0]?.count ?? 0,
        }, null, 2));
    } finally {
        await client.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
