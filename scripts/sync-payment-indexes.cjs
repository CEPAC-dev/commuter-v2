/* eslint-disable @typescript-eslint/no-require-imports */
// One-shot: syncs Mongoose indexes for Payment (adds the new unique partial
// index blocking duplicate active Payments per booking). Safe to re-run.
// Run: node scripts/sync-payment-indexes.cjs
require("dotenv").config({ path: ".env.local" });
const mongoose = require("mongoose");

(async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI missing");
    await mongoose.connect(uri);

    // Guard: fail loudly instead of silently if duplicate active Payments
    // already exist — createIndexes would otherwise throw a cryptic E11000.
    const dupes = await mongoose.connection
        .collection("payments")
        .aggregate([
            {
                $match: {
                    overallStatus: { $in: ["created", "wallet_reserved", "kashier_pending"] },
                },
            },
            { $group: { _id: "$bookingId", count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
        ])
        .toArray();
    if (dupes.length) {
        console.warn(
            "Found bookings with multiple active Payments — resolve manually before the unique index can build:",
            dupes.map((d) => String(d._id)),
        );
    } else {
        await mongoose.connection.collection("payments").createIndex(
            { bookingId: 1 },
            {
                unique: true,
                partialFilterExpression: {
                    overallStatus: { $in: ["created", "wallet_reserved", "kashier_pending"] },
                },
                name: "bookingId_1_active_unique",
            },
        );
        console.log("Index synced.");
    }
    await mongoose.disconnect();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
