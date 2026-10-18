import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";

loadEnvConfig(process.cwd());

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
const chatRetentionDays = Number(
  process.env.CHAT_RETENTION_DAYS?.trim() || "30",
);
const maxChatRetentionDays = Math.floor(2_147_483_647 / (24 * 60 * 60));
if (
  !Number.isSafeInteger(chatRetentionDays) ||
  chatRetentionDays < 1 ||
  chatRetentionDays > maxChatRetentionDays
) {
  throw new Error(
    `CHAT_RETENTION_DAYS must be a whole number between 1 and ${maxChatRetentionDays}.`,
  );
}
const MESSAGE_RETENTION_TTL_INDEX = {
  keys: { createdAt: 1 },
  options: {
    expireAfterSeconds: chatRetentionDays * 24 * 60 * 60,
    name: "chat_messages_created_at_ttl",
  },
};
const CHAT_READ_STATE_UNIQUE_INDEX = {
  keys: { tripId: 1, userId: 1 },
  options: {
    unique: true,
    name: "chat_read_state_trip_user_unique",
  },
};
const CHAT_READ_STATE_TTL_INDEX = {
  keys: { updatedAt: 1 },
  options: {
    expireAfterSeconds: (chatRetentionDays + 7) * 24 * 60 * 60,
    name: "chat_read_state_updated_at_ttl",
  },
};
const RIDE_INCIDENT_OPEN_UNIQUE_INDEX = {
  keys: { rideId: 1 },
  options: {
    unique: true,
    partialFilterExpression: { status: "open" },
    name: "ride_one_open_incident",
  },
};
const RIDE_INCIDENT_NOTIFICATION_UNIQUE_INDEX = {
  keys: { userId: 1, "data.incidentId": 1 },
  options: {
    unique: true,
    partialFilterExpression: { type: "ride_incident" },
    name: "ride_incident_passenger_notification_unique",
  },
};
const RIDE_INCIDENT_OUTCOME_NOTIFICATION_UNIQUE_INDEX = {
  keys: { userId: 1, "data.dedupeKey": 1 },
  options: {
    unique: true,
    partialFilterExpression: { type: "ride_incident_resolution" },
    name: "ride_incident_outcome_notification_unique",
  },
};
const NO_SHOW_TRIP_NOTIFICATION_UNIQUE_INDEX = {
  keys: { userId: 1, "data.tripId": 1 },
  options: {
    unique: true,
    partialFilterExpression: { type: "no_show_trip" },
    name: "no_show_trip_notification_unique",
  },
};

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
  const messages = database.collection("messages");
  const chatReadStates = database.collection("chat_read_states");
  const rideIncidents = database.collection("ride_incidents");
  const notifications = database.collection("notifications");

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
    const chatReportsExist = await database
      .listCollections({ name: "chat_reports" })
      .hasNext();
    const [duplicateOpenChatReport] = chatReportsExist
      ? await chatReports
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
          .toArray()
      : [];
    console.log(
      duplicateOpenChatReport
        ? "chat_reports open-report unique-index duplicates: yes"
        : "chat_reports open-report unique-index duplicates: no",
    );
    if (duplicateOpenChatReport) process.exitCode = 1;
    const indexesFor = async (name) => {
      const exists = await database.listCollections({ name }).hasNext();
      return exists
        ? await database.collection(name).listIndexes().toArray()
        : [];
    };
    const [messageIndexes, chatReportIndexes] = await Promise.all([
      indexesFor("messages"),
      indexesFor("chat_reports"),
    ]);
    const readStateIndexes = await indexesFor("chat_read_states");
    const [rideIncidentIndexes, notificationIndexes] = await Promise.all([
      indexesFor("ride_incidents"),
      indexesFor("notifications"),
    ]);
    const messageTtlReady = messageIndexes.some(
      (index) =>
        index.name === MESSAGE_RETENTION_TTL_INDEX.options.name &&
        index.key.createdAt === 1 &&
        index.expireAfterSeconds ===
          MESSAGE_RETENTION_TTL_INDEX.options.expireAfterSeconds,
    );
    const chatReportUniqueReady = chatReportIndexes.some(
      (index) =>
        index.name === CHAT_REPORT_OPEN_UNIQUE_INDEX.options.name &&
        index.key.reporterId === 1 &&
        index.key.tripId === 1 &&
        index.unique === true &&
        index.partialFilterExpression?.status === "open",
    );
    console.log(
      `messages retention TTL index (${chatRetentionDays} days): ${messageTtlReady ? "ready" : "missing or mismatched"}`,
    );
    console.log(
      `chat_reports open-report unique index: ${chatReportUniqueReady ? "ready" : "missing"}`,
    );
    const chatReadStateUniqueReady = readStateIndexes.some(
      (index) =>
        index.name === CHAT_READ_STATE_UNIQUE_INDEX.options.name &&
        index.key.tripId === 1 &&
        index.key.userId === 1 &&
        index.unique === true,
    );
    const chatReadStateTtlReady = readStateIndexes.some(
      (index) =>
        index.name === CHAT_READ_STATE_TTL_INDEX.options.name &&
        index.key.updatedAt === 1 &&
        index.expireAfterSeconds ===
          CHAT_READ_STATE_TTL_INDEX.options.expireAfterSeconds,
    );
    console.log(
      `chat_read_states unique trip/user index: ${chatReadStateUniqueReady ? "ready" : "missing"}`,
    );
    console.log(
      `chat_read_states TTL index (+7 days): ${chatReadStateTtlReady ? "ready" : "missing or mismatched"}`,
    );
    const rideIncidentUniqueReady = rideIncidentIndexes.some(
      (index) =>
        index.name === RIDE_INCIDENT_OPEN_UNIQUE_INDEX.options.name &&
        index.key.rideId === 1 &&
        index.unique === true &&
        index.partialFilterExpression?.status === "open",
    );
    const rideIncidentNotificationUniqueReady = notificationIndexes.some(
      (index) =>
        index.name === RIDE_INCIDENT_NOTIFICATION_UNIQUE_INDEX.options.name &&
        index.key.userId === 1 &&
        index.key["data.incidentId"] === 1 &&
        index.unique === true &&
        index.partialFilterExpression?.type === "ride_incident",
    );
    const rideIncidentOutcomeNotificationUniqueReady =
      notificationIndexes.some(
        (index) =>
        index.name ===
          RIDE_INCIDENT_OUTCOME_NOTIFICATION_UNIQUE_INDEX.options.name &&
        index.key.userId === 1 &&
        index.key["data.dedupeKey"] === 1 &&
        index.unique === true &&
        index.partialFilterExpression?.type === "ride_incident_resolution",
      );
    const noShowTripNotificationUniqueReady = notificationIndexes.some(
      (index) =>
        index.name === NO_SHOW_TRIP_NOTIFICATION_UNIQUE_INDEX.options.name &&
        index.key.userId === 1 &&
        index.key["data.tripId"] === 1 &&
        index.unique === true &&
        index.partialFilterExpression?.type === "no_show_trip",
    );
    console.log(
      `ride_incidents one-open-per-ride unique index: ${rideIncidentUniqueReady ? "ready" : "missing"}`,
    );
    console.log(
      `ride incident passenger notification unique index: ${rideIncidentNotificationUniqueReady ? "ready" : "missing"}`,
    );
    console.log(
      `ride incident outcome notification unique index: ${rideIncidentOutcomeNotificationUniqueReady ? "ready" : "missing"}`,
    );
    console.log(
      `no-show Trip notification unique index: ${noShowTripNotificationUniqueReady ? "ready" : "missing"}`,
    );
    if (
      !messageTtlReady ||
      !chatReportUniqueReady ||
      !chatReadStateUniqueReady ||
      !chatReadStateTtlReady ||
      !rideIncidentUniqueReady ||
      !rideIncidentNotificationUniqueReady ||
      !rideIncidentOutcomeNotificationUniqueReady ||
      !noShowTripNotificationUniqueReady
    ) process.exitCode = 1;
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
    const messagesExist = await database
      .listCollections({ name: "messages" })
      .hasNext();
    const currentMessageIndexes = messagesExist
      ? await messages.listIndexes().toArray()
      : [];
    const currentMessageTtl = currentMessageIndexes.find(
      (index) => index.name === MESSAGE_RETENTION_TTL_INDEX.options.name,
    );
    if (
      currentMessageTtl &&
      (currentMessageTtl.expireAfterSeconds !==
        MESSAGE_RETENTION_TTL_INDEX.options.expireAfterSeconds ||
        currentMessageTtl.key.createdAt !== 1)
    ) {
      await messages.dropIndex(MESSAGE_RETENTION_TTL_INDEX.options.name);
    }
    await messages.createIndex(
      MESSAGE_RETENTION_TTL_INDEX.keys,
      MESSAGE_RETENTION_TTL_INDEX.options,
    );
    await chatReadStates.createIndex(
      CHAT_READ_STATE_UNIQUE_INDEX.keys,
      CHAT_READ_STATE_UNIQUE_INDEX.options,
    );
    const currentReadStateIndexes = await chatReadStates.listIndexes().toArray();
    const currentReadStateTtl = currentReadStateIndexes.find(
      (index) => index.name === CHAT_READ_STATE_TTL_INDEX.options.name,
    );
    if (
      currentReadStateTtl &&
      (currentReadStateTtl.expireAfterSeconds !==
        CHAT_READ_STATE_TTL_INDEX.options.expireAfterSeconds ||
        currentReadStateTtl.key.updatedAt !== 1)
    ) {
      await chatReadStates.dropIndex(CHAT_READ_STATE_TTL_INDEX.options.name);
    }
    await chatReadStates.createIndex(
      CHAT_READ_STATE_TTL_INDEX.keys,
      CHAT_READ_STATE_TTL_INDEX.options,
    );
    await rideIncidents.createIndex(
      RIDE_INCIDENT_OPEN_UNIQUE_INDEX.keys,
      RIDE_INCIDENT_OPEN_UNIQUE_INDEX.options,
    );
    await notifications.createIndex(
      RIDE_INCIDENT_NOTIFICATION_UNIQUE_INDEX.keys,
      RIDE_INCIDENT_NOTIFICATION_UNIQUE_INDEX.options,
    );
    await notifications.createIndex(
      RIDE_INCIDENT_OUTCOME_NOTIFICATION_UNIQUE_INDEX.keys,
      RIDE_INCIDENT_OUTCOME_NOTIFICATION_UNIQUE_INDEX.options,
    );
    await notifications.createIndex(
      NO_SHOW_TRIP_NOTIFICATION_UNIQUE_INDEX.keys,
      NO_SHOW_TRIP_NOTIFICATION_UNIQUE_INDEX.options,
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
