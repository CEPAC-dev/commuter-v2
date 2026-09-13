/**
 * Approved backfill: historical operational records default to EG-CAIRO when regionCode is missing.
 * Usage: node scripts/backfill-operational-regions.cjs
 */
const fs = require("fs");
const { MongoClient } = require("mongodb");

const DEFAULT_REGION = "EG-CAIRO";
const COLLECTIONS = ["requests", "trips", "rides", "availabilities"];

function loadEnv() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['\"]|['\"]$/g, "");
  }
}

async function main() {
  loadEnv();
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db(process.env.DB_NAME);

    for (const name of COLLECTIONS) {
      const result = await db.collection(name).updateMany(
        {
          $or: [
            { regionCode: { $in: [null, ""] } },
            { regionCode: { $exists: false } },
          ],
        },
        { $set: { regionCode: DEFAULT_REGION } },
      );
      console.log(JSON.stringify({ collection: name, matched: result.matchedCount, modified: result.modifiedCount }));
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
