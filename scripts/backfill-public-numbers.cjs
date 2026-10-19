const mongoose = require("mongoose");
const { loadEnvConfig } = require("@next/env");

const collections = [
    { name: "users", field: "userNumber", sequence: "userNumber" },
    { name: "trips", field: "tripNumber", sequence: "tripNumber" },
    {
        name: "availabilities",
        field: "availabilityNumber",
        sequence: "availabilityNumber",
    },
];

async function nextSequence(counters, sequence) {
    const result = await counters.findOneAndUpdate(
        { _id: sequence },
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: "after" },
    );
    return result.value.value;
}

async function backfillCollection(db, config) {
    const collection = db.collection(config.name);
    const counters = db.collection("counters");
    const highest = await collection
        .find({ [config.field]: { $type: "number" } })
        .sort({ [config.field]: -1 })
        .limit(1)
        .toArray();
    const highestNumber = highest[0]?.[config.field] ?? 0;

    await counters.updateOne(
        { _id: config.sequence },
        { $max: { value: highestNumber } },
        { upsert: true },
    );

    let updated = 0;
    const missing = collection
        .find({ $or: [{ [config.field]: { $exists: false } }, { [config.field]: null }] })
        .sort({ createdAt: 1, _id: 1 });

    for await (const document of missing) {
        const number = await nextSequence(counters, config.sequence);
        const result = await collection.updateOne(
            {
                _id: document._id,
                $or: [
                    { [config.field]: { $exists: false } },
                    { [config.field]: null },
                ],
            },
            { $set: { [config.field]: number } },
        );
        updated += result.modifiedCount;
    }

    console.log(`${config.name}: ${updated} records assigned`);
}

async function main() {
    loadEnvConfig(process.cwd());
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");

    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.DB_NAME,
    });
    const db = mongoose.connection.db;

    for (const config of collections) await backfillCollection(db, config);

    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});