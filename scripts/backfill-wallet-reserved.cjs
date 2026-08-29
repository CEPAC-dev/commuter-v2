/* eslint-disable @typescript-eslint/no-require-imports */
// One-shot: sets reservedBalanceEgp:0 on legacy wallet docs missing the field.
// Run: node scripts/backfill-wallet-reserved.cjs
require("dotenv").config({ path: ".env.local" });
const mongoose = require("mongoose");

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing");
  await mongoose.connect(uri);
  const res = await mongoose.connection
    .collection("wallets")
    .updateMany(
      { reservedBalanceEgp: { $exists: false } },
      { $set: { reservedBalanceEgp: 0 } },
    );
  console.log("matched:", res.matchedCount, "modified:", res.modifiedCount);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
