import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { readPublicShare } from "@/lib/liveShare/public";
import { assertLiveShareSecret } from "@/lib/liveShare/token";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { TripShare } from "@/models/TripShare";

interface RouteContext {
  params: Promise<{ token: string }>;
}

const PUBLIC_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

function publicJson(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: PUBLIC_HEADERS });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const secret = assertLiveShareSecret();
    const { token } = await params;
    await connectDB();
    const result = await readPublicShare(
      { token, secret, now: new Date() },
      {
        async load(shareId) {
          const share = await TripShare.findById(shareId)
            .select(
              "tripId active revokedAt endedAt expiresAt lastLocation viewCount lastViewedAt",
            )
            .lean();
          if (!share) return null;

          const trip = await Trip.findById(share.tripId)
            .select(
              "userId driverId status pickup dropoff rideId assignedDriver updatedAt",
            )
            .lean();
          if (!trip) return null;
          const ride = trip.rideId
            ? await Ride.findById(trip.rideId)
                .select("status updatedAt")
                .lean()
            : null;
          return {
            share: {
              id: String(share._id),
              active: share.active,
              revokedAt: share.revokedAt,
              endedAt: share.endedAt,
              expiresAt: share.expiresAt,
              lastLocation: share.lastLocation,
              viewCount: share.viewCount,
              lastViewedAt: share.lastViewedAt,
            },
            trip,
            ride,
          };
        },
        async markEnded(shareId, endedAt) {
          await TripShare.updateOne(
            { _id: shareId, endedAt: null },
            { $set: { endedAt }, $unset: { lastLocation: 1 } },
          );
        },
        async touchViewer(shareId, now, earliestLastViewedAt) {
          await TripShare.updateOne(
            {
              _id: shareId,
              active: true,
              revokedAt: null,
              expiresAt: { $gt: now },
              $or: [
                { lastViewedAt: { $exists: false } },
                { lastViewedAt: null },
                { lastViewedAt: { $lte: earliestLastViewedAt } },
              ],
            },
            { $inc: { viewCount: 1 }, $set: { lastViewedAt: now } },
          );
        },
      },
      async () => {
        await enforceRateLimit(request, "live-share-failed-token", {
          limit: 30,
          windowMs: 60_000,
        });
      },
    );
    return publicJson(result.body, result.status);
  } catch {
    console.error("[GET /api/live/[token]] Public live-share request failed.");
    return publicJson({ error: "Unable to load live location." }, 500);
  }
}
