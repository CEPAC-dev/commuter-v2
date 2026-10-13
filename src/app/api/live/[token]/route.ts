import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import {
  INVALID_PUBLIC_SHARE,
  readPublicShare,
} from "@/lib/liveShare/public";
import { assertLiveShareSecret, verifyShareToken } from "@/lib/liveShare/token";
import { logLiveShareFailure } from "@/lib/liveShare/errors";
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

function publicJson(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string> = {},
) {
  return NextResponse.json(body, {
    status,
    headers: { ...PUBLIC_HEADERS, ...headers },
  });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const secret = assertLiveShareSecret();
    const { token } = await params;
    if (!verifyShareToken(token, secret)) {
      return publicJson(INVALID_PUBLIC_SHARE, 404);
    }
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
        const limited = await enforceRateLimit(request, "live-share-failed-token", {
          limit: 30,
          windowMs: 60_000,
        });
        return limited?.headers.get("Retry-After") ?? null;
      },
    );
    return publicJson(result.body, result.status, result.headers);
  } catch (error) {
    logLiveShareFailure("[GET /api/live/[token]]", error);
    return publicJson({ error: "Unable to load live location." }, 500);
  }
}
