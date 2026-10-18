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
  const stalePaymentCutoff = new Date(Date.now() - 35 * 60 * 1000);

  const [
    unpaidAmountMismatches,
    requestsWithoutRemainingChildren,
    childrenWithMissingRequest,
    cancelledRequestsWithActiveChildren,
    paidCancelledChildren,
    requestsWithStalePayments,
    paymentsWithManualReview,
  ] = await Promise.all([
    requests
      .aggregate([
        {
          $match: {
            status: { $ne: "cancelled" },
            paymentStatus: { $nin: ["paid", "refunded"] },
          },
        },
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
    trips
      .find({ status: "cancelled", paymentStatus: "paid" })
      .project({ _id: 1 })
      .sort({ _id: 1 })
      .toArray(),
    payments
      .aggregate([
        {
          $match: {
            overallStatus: {
              $in: ["created", "wallet_reserved", "kashier_pending"],
            },
            createdAt: { $lt: stalePaymentCutoff },
          },
        },
        {
          $lookup: {
            from: "requests",
            localField: "bookingId",
            foreignField: "_id",
            as: "parentRequest",
          },
        },
        { $match: { parentRequest: { $ne: [] } } },
        { $group: { _id: "$bookingId" } },
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
      name: "unpaid_non_cancelled_request_amount_mismatches",
      count: unpaidAmountMismatches.length,
      ids: unpaidAmountMismatches.map(({ _id }) => String(_id)),
    },
    {
      report: 2,
      name: "non_cancelled_requests_without_remaining_children",
      count: requestsWithoutRemainingChildren.length,
      ids: requestsWithoutRemainingChildren.map(({ _id }) => String(_id)),
    },
    {
      report: 3,
      name: "children_with_missing_request",
      count: childrenWithMissingRequest.length,
      ids: childrenWithMissingRequest.map(({ _id }) => String(_id)),
    },
    {
      report: 4,
      name: "cancelled_requests_with_non_cancelled_children",
      count: cancelledRequestsWithActiveChildren.length,
      ids: cancelledRequestsWithActiveChildren.map(({ _id }) => String(_id)),
    },
    {
      report: 5,
      name: "cancelled_children_with_paid_payment_status",
      count: paidCancelledChildren.length,
      ids: paidCancelledChildren.map(({ _id }) => String(_id)),
    },
    {
      report: 6,
      name: "requests_with_active_payments_older_than_35_minutes",
      count: requestsWithStalePayments.length,
      ids: requestsWithStalePayments.map(({ _id }) => String(_id)),
    },
    {
      report: 7,
      name: "payments_with_request_manual_review_timeline_event",
      count: paymentsWithManualReview.length,
      ids: paymentsWithManualReview.map(({ _id }) => String(_id)),
    },
  ];

  console.log(JSON.stringify(reports, null, 2));
  process.exitCode = reports.every((report) => report.count === 0) ? 0 : 1;
} finally {
  await mongoose.disconnect();
}
