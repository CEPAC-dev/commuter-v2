import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { getAdminSettings, getNomatchSweepFilter } from "@/lib/cancellationPolicy";
import { logTripNomatch } from "@/lib/services/logActionHelpers";
import { expireStandaloneTrips } from "@/lib/services/standaloneTripExpiry";
import {
  buildUnlinkedTripExpiryFilter,
  buildPendingRequestExpiryFilter,
  buildPendingTripExpiryFilter,
} from "@/lib/pendingRequestHardening";
import { isMatchingEndpointAuthorized, isValidCronSecret } from "@/lib/matchingEndpointGuards";
import { selectModifiedNomatchTrips } from "@/lib/nomatchLogging";
import { releasePromoForRequest } from "@/lib/promoCode";

const EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Expires eligible pending bookings and unmatched Trips.
 * Scheduler requests must send the x-cron-secret header.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (
    process.env.NODE_ENV === "production" &&
    !isValidCronSecret(secret, secret)
  ) {
    return NextResponse.json(
      { error: "CRON_SECRET must be configured with at least 32 characters." },
      { status: 500 },
    );
  }
  if (
    !isMatchingEndpointAuthorized({
      isAdmin: false,
      configuredCronSecret: secret,
      providedCronSecret: req.headers.get("x-cron-secret") ?? undefined,
    })
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const nomatchFilter = buildUnlinkedTripExpiryFilter("submitted", {
    $or: nomatchOr,
  });
  const nomatchCandidates = await Trip.find(nomatchFilter)
    .select("_id userId")
    .lean<{ _id: Types.ObjectId; userId: Types.ObjectId }[]>();
  const nomatchUpdates = await Promise.all(
    nomatchCandidates.map(async (trip) => {
      const result = await Trip.updateOne(
        { _id: trip._id, ...nomatchFilter },
        { $set: { status: "nomatch" } },
      );
      return result.modifiedCount === 1 ? String(trip._id) : null;
    }),
  );
  const transitionedTrips = selectModifiedNomatchTrips(
    nomatchCandidates,
    nomatchUpdates.filter((tripId): tripId is string => tripId !== null),
  );
  await Promise.all(
    transitionedTrips.map((trip) => logTripNomatch(trip._id, trip.userId)),
  );

  return NextResponse.json({
    expiredRequests,
    expiredTrips,
    expiredStandaloneTrips: standaloneExpiry.expiredTrips,
    cancelledStandalonePayments: standaloneExpiry.cancelledPayments,
    releasedStandaloneWalletReservations:
      standaloneExpiry.releasedWalletReservations,
    nomatchedTrips: transitionedTrips.length,
  });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
