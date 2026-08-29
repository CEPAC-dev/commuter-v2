/* eslint-disable @typescript-eslint/no-require-imports */
// One-shot: creates missing `kashier_payment` ledger rows for historical Payments
// that already reached overallStatus:"paid" with gatewayAmountEgp > 0.
// Run: node scripts/backfill-kashier-payment-ledger.cjs
require("dotenv").config({ path: ".env.local" });
const mongoose = require("mongoose");

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing");
  await mongoose.connect(uri);
  const db = mongoose.connection;

  const payments = await db
    .collection("payments")
    .find({
      overallStatus: { $in: ["paid", "partially_refunded", "refunded"] },
      gatewayAmountEgp: { $gt: 0 },
    })
    .toArray();

  let created = 0;
  for (const p of payments) {
    const existing = await db
      .collection("wallettransactions")
      .findOne({ paymentId: p._id, type: "kashier_payment" });
    if (existing) continue;
    await db.collection("wallettransactions").insertOne({
      userId: p.userId,
      type: "kashier_payment",
      amountEgp: p.gatewayAmountEgp,
      status: "completed",
      description: `Card payment via Kashier for booking ${p.bookingId}`,
      paymentId: p._id,
      bookingId: p.bookingId,
      kashierSessionId: p.kashierSessionId ?? undefined,
      kashierOrderId: p.kashierOrderId ?? undefined,
      kashierTransactionIds: p.kashierTransactionIds ?? [],
      createdAt: p.paidAt ?? p.createdAt ?? new Date(),
      updatedAt: new Date(),
    });
    created++;
  }
  console.log("payments scanned:", payments.length, "rows created:", created);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
