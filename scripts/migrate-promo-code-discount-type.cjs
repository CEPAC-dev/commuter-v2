const mongoose = require("mongoose");
const { loadEnvConfig } = require("@next/env");

// Backfills legacy promo_codes/promo_code_usages documents (discountPercentage)
// to the new discountType/discountValue schema, defaulting to "percentage".
async function migratePromoCodes(db) {
    const collection = db.collection("promo_codes");
    const result = await collection.updateMany(
        { discountType: { $exists: false }, discountPercentage: { $exists: true } },
        [
            {
                $set: {
                    discountType: "percentage",
                    discountValue: "$discountPercentage",
                },
            },
        ],
    );
    console.log(`promo_codes: ${result.modifiedCount} documents migrated`);
}

async function migratePromoCodeUsages(db) {
    const collection = db.collection("promo_code_usages");
    const result = await collection.updateMany(
        { discountType: { $exists: false }, discountPercentage: { $exists: true } },
        [
            {
                $set: {
                    discountType: "percentage",
                    discountValue: "$discountPercentage",
                },
            },
        ],
    );
    console.log(`promo_code_usages: ${result.modifiedCount} documents migrated`);
}

async function main() {
    loadEnvConfig(process.cwd());
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");

    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.DB_NAME,
    });
    const db = mongoose.connection.db;

    await migratePromoCodes(db);
    await migratePromoCodeUsages(db);

    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});
