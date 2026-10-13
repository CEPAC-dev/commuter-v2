import mongoose from "mongoose";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is required to audit Request groups");
}

try {
  await mongoose.connect(uri);
  const database = mongoose.connection.db;
  if (!database) throw new Error("MongoDB database connection is unavailable");

  const requests = database.collection("requests");
  const trips = database.collection("trips");
  const payments = database.collection("payments");

  const [
    unpaidAmountMismatches,
    activeRequestsWithoutRemainingTrips,
    orphanedRequestChildren,
    cancelledRequestsWithActiveChildren,
    paymentsWithManualReview,
  ] = await Promise.all([
    requests
      .aggregate([
        { $match: { paymentStatus: { $ne: "paid" } } },
        {
          $lookup: {
            from: "trips",
            let: { requestId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$requestId", "$$requestId"] },
                  status: { $ne: "cancelled" },
                },
              },
              { $group: { _id: null, amountEgp: { $sum: "$priceEgp" } } },
            ],
            as: "remainingTotals",
          },
        },
        {
          $set: {
            remainingAmountEgp: {
              $ifNull: [{ $first: "$remainingTotals.amountEgp" }, 0],
            },
          },
        },
        { $match: { $expr: { $ne: ["$amountEgp", "$remainingAmountEgp"] } } },
        { $project: { _id: 1 } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    requests
      .aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        {
          $lookup: {
            from: "trips",
            let: { requestId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$requestId", "$$requestId"] },
                  status: { $ne: "cancelled" },
                },
              },
              { $limit: 1 },
            ],
            as: "remainingTrips",
          },
        },
        { $match: { remainingTrips: { $eq: [] } } },
        { $project: { _id: 1 } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    trips
      .aggregate([
        { $match: { requestId: { $exists: true, $ne: null } } },
        {
          $lookup: {
            from: "requests",
            localField: "requestId",
            foreignField: "_id",
            as: "parentRequest",
          },
        },
        { $match: { parentRequest: { $eq: [] } } },
        { $project: { _id: 1 } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    requests
      .aggregate([
        { $match: { status: "cancelled" } },
        {
          $lookup: {
            from: "trips",
            let: { requestId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$requestId", "$$requestId"] },
                  status: { $ne: "cancelled" },
                },
              },
              { $project: { _id: 1 } },
            ],
            as: "activeChildren",
          },
        },
        { $match: { "activeChildren.0": { $exists: true } } },
        { $project: { _id: 1 } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    payments
      .aggregate([
        {
          $match: {
            timeline: {
              $elemMatch: { event: "request_payment_manual_review" },
            },
          },
        },
        { $project: { _id: 1 } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
  ]);

  const reports = [
    {
      report: 1,
      name: "unpaid_request_amount_mismatches",
      count: unpaidAmountMismatches.length,
      ids: unpaidAmountMismatches.map(({ _id }) => String(_id)),
    },
    {
      report: 2,
      name: "non_cancelled_requests_without_remaining_children",
      count: activeRequestsWithoutRemainingTrips.length,
      ids: activeRequestsWithoutRemainingTrips.map(({ _id }) => String(_id)),
    },
    {
      report: 3,
      name: "children_with_missing_request",
      count: orphanedRequestChildren.length,
      ids: orphanedRequestChildren.map(({ _id }) => String(_id)),
    },
    {
      report: 4,
      name: "cancelled_requests_with_non_cancelled_children",
      count: cancelledRequestsWithActiveChildren.length,
      ids: cancelledRequestsWithActiveChildren.map(({ _id }) => String(_id)),
    },
    {
      report: 7,
      name: "payments_with_request_manual_review_timeline_event",
      count: paymentsWithManualReview.length,
      ids: paymentsWithManualReview.map(({ _id }) => String(_id)),
    },
  ];

  console.log(JSON.stringify(reports, null, 2));
} finally {
  await mongoose.disconnect();
}
