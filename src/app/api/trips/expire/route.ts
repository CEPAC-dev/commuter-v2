import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { getAdminSettings, getNomatchSweepFilter } from "@/lib/cancellationPolicy";
import { logTripNomatch } from "@/lib/services/logActionHelpers";
import { expireStandaloneTrips } from "@/lib/services/standaloneTripExpiry";
import {
  buildPendingRequestExpiryFilter,
  buildPendingTripExpiryFilter,
} from "@/lib/pendingRequestHardening";
import { isAuthorizedExpiryRequest } from "@/lib/phase8bGuards";
import { releasePromoForRequest } from "@/lib/promoCode";

const EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Expires bookings that have been in pending_payment / pending state for
 * more than 2 hours.  Safe to call multiple times (idempotent).
 *
 * Protected by an optional CRON_SECRET env var.
 * Set Authorization: Bearer <CRON_SECRET> when calling from a cron service.
 * Production requests fail closed when CRON_SECRET is missing.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!isAuthorizedExpiryRequest(secret, process.env.NODE_ENV === "production", auth)) {
    return NextResponse.json(
      {
        error: secret
          ? "Unauthorized"
          : "CRON_SECRET is required in production.",
      },
      { status: secret ? 401 : 500 },
    );
  }
  if (secret) {
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  await connectDB();

  const cutoff = new Date(Date.now() - EXPIRY_MS);

  const expireFilter = buildPendingRequestExpiryFilter(cutoff);
  const expiringRequests = await Request.find(expireFilter)
    .select("_id")
    .lean<{ _id: Types.ObjectId }[]>();
  const requestIds = expiringRequests.map((request) => request._id);
  let expiredRequests = 0;
  let expiredTrips = 0;
  for (const requestId of requestIds) {
    const dbSession = await mongoose.startSession();
    let requestChanged = false;
    let tripCount = 0;
    try {
      await dbSession.withTransaction(async () => {
        requestChanged = false;
        tripCount = 0;
        const updated = await Request.updateOne(
          { _id: requestId, ...expireFilter },
          { $set: { status: "time_out", paymentStatus: "expired" } },
          { session: dbSession },
        );
        if (updated.modifiedCount !== 1) return;
        requestChanged = true;
        const trips = await Trip.updateMany(
          buildPendingTripExpiryFilter([requestId]),
          { $set: { status: "time_out", paymentStatus: "expired" } },
          { session: dbSession },
        );
        tripCount = trips.modifiedCount;
        await releasePromoForRequest(requestId, { session: dbSession });
      });
      if (requestChanged) expiredRequests += 1;
      expiredTrips += tripCount;
    } finally {
      await dbSession.endSession();
    }
  }
  const standaloneExpiry = await expireStandaloneTrips();

  // Auto-mark unmatched "submitted" trips as "nomatch" past the admin-configured cutoff.
  const settings = await getAdminSettings();
  const nomatchOr = getNomatchSweepFilter(new Date(), settings.nomatchCutoffTime);
  const nomatchCandidates = await Trip.find({
    status: "submitted",
    $or: nomatchOr,
  }).select("_id userId");

  if (nomatchCandidates.length > 0) {
    await Trip.updateMany(
      { _id: { $in: nomatchCandidates.map((t) => t._id) } },
      { $set: { status: "nomatch" } },
    );
    await Promise.all(
      nomatchCandidates.map((t) => logTripNomatch(t._id, t.userId)),
    );
  }

  return NextResponse.json({
    expiredRequests,
    expiredTrips,
    expiredStandaloneTrips: standaloneExpiry.expiredTrips,
    cancelledStandalonePayments: standaloneExpiry.cancelledPayments,
    releasedStandaloneWalletReservations:
      standaloneExpiry.releasedWalletReservations,
    nomatchedTrips: nomatchCandidates.length,
  });
}

// Allow Vercel Cron to call via GET as well
export const GET = POST;
