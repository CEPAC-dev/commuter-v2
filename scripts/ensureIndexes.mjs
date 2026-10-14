import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";

const TRIP_SHARE_ACTIVE_INDEX = {
  keys: { tripId: 1, userId: 1 },
  options: {
    unique: true,
    partialFilterExpression: { active: true },
    name: "trip_user_one_active_share",
  },
};
const TRIP_SHARE_DELETE_AT_INDEX = {
  keys: { deleteAt: 1 },
  options: {
    expireAfterSeconds: 0,
    name: "trip_share_delete_at_ttl",
  },
};
const CHAT_REPORT_OPEN_UNIQUE_INDEX = {
  keys: { reporterId: 1, tripId: 1 },
  options: {
    unique: true,
    partialFilterExpression: { status: "open" },
    name: "chat_reporter_trip_one_open",
  },
};

loadEnvConfig(process.cwd());

const production =
  (process.env.APP_ENV ?? process.env.NODE_ENV ?? "development").toLowerCase() ===
  "production";
const uri = production
  ? process.env.PROD_MONGODB_URI ?? process.env.MONGODB_URI
  : process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not configured.");
}

const dbName = production
  ? process.env.PROD_DB_NAME ?? process.env.DB_NAME
  : process.env.DB_NAME;
const checkOnly = process.argv.includes("--check");

try {
  await mongoose.connect(uri, dbName ? { dbName } : {});
  const database = mongoose.connection.db;
  if (!database) throw new Error("MongoDB connection is unavailable.");
  const walletTransactions = database.collection("wallettransactions");
  const tripShares = database.collection("tripshares");
  const chatReports = database.collection("chat_reports");

  if (checkOnly) {
    const [duplicate] = await walletTransactions
      .aggregate([
        {
          $match: {
            type: "kashier_payment",
            tripId: { $exists: true },
          },
        },
        {
          $group: {
            _id: { paymentId: "$paymentId", tripId: "$tripId", type: "$type" },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $limit: 1 },
      ])
      .toArray();
    console.log(
      duplicate
        ? "wallettransactions unique-index duplicates: yes"
        : "wallettransactions unique-index duplicates: no",
    );
    const [duplicateOpenChatReport] = await chatReports
      .aggregate([
        { $match: { status: "open" } },
        {
          $group: {
            _id: { reporterId: "$reporterId", tripId: "$tripId" },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $limit: 1 },
      ])
      .toArray();
    console.log(
      duplicateOpenChatReport
        ? "chat_reports open-report unique-index duplicates: yes"
        : "chat_reports open-report unique-index duplicates: no",
    );
  } else {
    await database.collection("trip_spacing_locks").createIndex(
      { updatedAt: 1 },
      {
        expireAfterSeconds: 30 * 24 * 60 * 60,
        name: "trip_spacing_locks_updatedAt_ttl",
      },
    );
    await tripShares.createIndex(
      TRIP_SHARE_ACTIVE_INDEX.keys,
      TRIP_SHARE_ACTIVE_INDEX.options,
    );
    await tripShares.createIndex(
      TRIP_SHARE_DELETE_AT_INDEX.keys,
      TRIP_SHARE_DELETE_AT_INDEX.options,
    );
    await chatReports.createIndex(
      CHAT_REPORT_OPEN_UNIQUE_INDEX.keys,
      CHAT_REPORT_OPEN_UNIQUE_INDEX.options,
    );
    await walletTransactions.createIndex(
      { paymentId: 1, tripId: 1, type: 1 },
      {
        unique: true,
        partialFilterExpression: {
          type: "kashier_payment",
          tripId: { $exists: true },
        },
        name: "paymentId_1_tripId_1_type_1",
      },
    );
    console.log("Standalone Trip indexes ensured.");
  }
} finally {
  await mongoose.disconnect();
}
