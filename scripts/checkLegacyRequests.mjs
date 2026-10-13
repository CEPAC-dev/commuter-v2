import mongoose from "mongoose";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is required to check legacy Requests");
}

const finalTripStatuses = [
  "rejected",
  "nomatch",
  "completed",
  "refunded",
  "cancelled",
  "time_out",
];

try {
  await mongoose.connect(uri);
  const requests = mongoose.connection.db.collection("requests");
  const trips = mongoose.connection.db.collection("trips");

  const [requestStatusCounts, liveRequests, legacyChildTrips] =
    await Promise.all([
      requests
        .aggregate([
          {
            $group: {
              _id: { status: "$status", paymentStatus: "$paymentStatus" },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.status": 1, "_id.paymentStatus": 1 } },
        ])
        .toArray(),
      requests.countDocuments({
        status: { $in: ["pending_payment", "waiting_list", "approved"] },
        paymentStatus: { $in: ["pending", "failed"] },
      }),
      trips.countDocuments({
        requestId: { $exists: true, $ne: null },
        status: { $nin: finalTripStatuses },
      }),
    ]);

  console.log(
    JSON.stringify(
      { requestStatusCounts, liveRequests, legacyChildTrips },
      null,
      2,
    ),
  );
} finally {
  await mongoose.disconnect();
}
