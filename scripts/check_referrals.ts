import mongoose from "mongoose";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      envVars[key] = val;
    }
  }
}

const MONGODB_URI = envVars.MONGODB_URI;
const DB_NAME = envVars.DB_NAME || "commuter-ae";

async function main() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });
  console.log("Connected to MongoDB database:", DB_NAME);

  const db = mongoose.connection.db;
  if (!db) {
    console.error("DB connection failed");
    process.exit(1);
  }

  const referralUsages = await db
    .collection("referral_usages")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  for (const usage of referralUsages) {
    const referrer = await db
      .collection("users")
      .findOne(
        { _id: usage.referrer },
        { projection: { name: 1, phone: 1, email: 1, role: 1 } },
      );
    const referee = await db
      .collection("users")
      .findOne(
        { _id: usage.referredUser },
        { projection: { name: 1, phone: 1, email: 1, role: 1 } },
      );
    const referrerWallet = await db
      .collection("wallets")
      .findOne({ userId: usage.referrer });
    const refereeWallet = await db
      .collection("wallets")
      .findOne({ userId: usage.referredUser });

    const referrerTxs = await db
      .collection("wallettransactions")
      .find({ userId: usage.referrer })
      .toArray();
    const refereeTxs = await db
      .collection("wallettransactions")
      .find({ userId: usage.referredUser })
      .toArray();

    console.log("=========================================");
    console.log(`ReferralUsage ID: ${usage._id}`);
    console.log(`Status: ${usage.status}`);
    console.log(`CreatedAt: ${usage.createdAt}`);
    console.log(`CreditedAt: ${usage.creditedAt}`);
    console.log("Referrer:", JSON.stringify(referrer));
    console.log("Referee:", JSON.stringify(referee));
    console.log("Referrer Wallet:", JSON.stringify(referrerWallet));
    console.log("Referee Wallet:", JSON.stringify(refereeWallet));
    console.log("Referrer Txs:", JSON.stringify(referrerTxs));
    console.log("Referee Txs:", JSON.stringify(refereeTxs));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
