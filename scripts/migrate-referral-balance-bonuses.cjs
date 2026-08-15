const mongoose = require("mongoose");
const { loadEnvConfig } = require("@next/env");

const DEFAULT_REFERRER_BONUS = 50;
const DEFAULT_REFEREE_BONUS = 100;

async function main() {
    loadEnvConfig(process.cwd());
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");

    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.DB_NAME,
    });
    const db = mongoose.connection.db;
    const settingsCollection = db.collection("referral_settings");
    const usageCollection = db.collection("referral_usages");

    const legacySettings = await settingsCollection.findOne({ singletonKey: "global" });
    const referrerBonusAmount = Number.isFinite(legacySettings?.referrerBonusAmount)
        ? legacySettings.referrerBonusAmount
        : DEFAULT_REFERRER_BONUS;
    const refereeBonusAmount = Number.isFinite(legacySettings?.refereeBonusAmount)
        ? legacySettings.refereeBonusAmount
        : DEFAULT_REFEREE_BONUS;

    await settingsCollection.updateOne(
        { singletonKey: "global" },
        {
            $set: { referrerBonusAmount, refereeBonusAmount },
            $unset: { discountPercentage: "", discountValidForTrips: "" },
        },
        { upsert: true },
    );

    const usageResult = await usageCollection.updateMany(
        { referrerBonusAmount: { $exists: false } },
        {
            $set: {
                referrerBonusAmount,
                refereeBonusAmount,
                status: "pending",
                creditedAt: null,
                firstTripId: null,
            },
            $unset: { discountPercentage: "", tripsRemaining: "" },
        },
    );

    console.log(`referral_settings: migrated global bonus amounts`);
    console.log(`referral_usages: ${usageResult.modifiedCount} documents migrated`);
    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});
