/* eslint-disable */
// Grant all `transactions.*` permissions to every existing admin user.
// Idempotent: only appends missing perms.
require("dotenv").config({ path: ".env.local" });
const mongoose = require("mongoose");

const ALL = [
  "transactions.view",
  "transactions.details",
  "transactions.export",
  "transactions.reports",
  "transactions.refund",
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const res = await mongoose.connection
    .collection("users")
    .updateMany(
      { role: "admin" },
      { $addToSet: { permissions: { $each: ALL } } },
    );
  console.log("matched:", res.matchedCount, "modified:", res.modifiedCount);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
