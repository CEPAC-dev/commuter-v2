import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { getAdminSettings, getNomatchSweepFilter } from "@/lib/cancellationPolicy";
import { logTripNomatch } from "@/lib/services/logActionHelpers";

const EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Expires bookings that have been in pending_payment / pending state for
 * more than 2 hours.  Safe to call multiple times (idempotent).
 *
 * Protected by an optional CRON_SECRET env var.
 * Set Authorization: Bearer <CRON_SECRET> when calling from a cron service.
 * If CRON_SECRET is unset the endpoint is open (fine for private/internal use).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  await connectDB();

  const cutoff = new Date(Date.now() - EXPIRY_MS);

  const expireFilter = {
    status: "pending_payment",
    paymentStatus: { $in: ["pending", "failed"] },
    createdAt: { $lte: cutoff },
  };

  const [reqResult, tripResult] = await Promise.all([
    Request.updateMany(expireFilter, {
      $set: { status: "time_out", paymentStatus: "expired" },
    }),
    Trip.updateMany(expireFilter, {
      $set: { status: "time_out", paymentStatus: "expired" },
    }),
  ]);

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
    expiredRequests: reqResult.modifiedCount,
    expiredTrips: tripResult.modifiedCount,
    nomatchedTrips: nomatchCandidates.length,
  });
}

// Allow Vercel Cron to call via GET as well
export const GET = POST;
