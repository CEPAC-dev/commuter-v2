import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { createTripLocationTokenRequest } from "@/lib/liveLocation/ably";
import { canShare, isEnded } from "@/lib/liveShare/eligibility";
import { logLiveShareFailure } from "@/lib/liveShare/errors";
import { assertLiveShareSecret, verifyShareToken } from "@/lib/liveShare/token";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { TripShare } from "@/models/TripShare";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const shareId = verifyShareToken(token, assertLiveShareSecret());
    if (!shareId) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: PRIVATE_HEADERS },
      );
    }

    await connectDB();
    const now = new Date();
    const share = await TripShare.findOne({
      _id: shareId,
      active: true,
      revokedAt: null,
      endedAt: null,
      expiresAt: { $gt: now },
    })
      .select("tripId")
      .lean();
    if (!share) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: PRIVATE_HEADERS },
      );
    }

    const trip = await Trip.findById(share.tripId)
      .select("_id userId driverId status rideId")
      .lean();
    if (!trip) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: PRIVATE_HEADERS },
      );
    }
    const ride = trip.rideId
      ? await Ride.findById(trip.rideId).select("status driverId").lean()
      : null;
    if (
      isEnded(trip, ride) ||
      !canShare(trip, String(trip.userId), ride)
    ) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: PRIVATE_HEADERS },
      );
    }

    const tokenRequest = await createTripLocationTokenRequest(
      String(trip._id),
      `share:${shareId}`,
    );
    return NextResponse.json(tokenRequest, { headers: PRIVATE_HEADERS });
  } catch (error) {
    logLiveShareFailure("[GET /api/live/[token]/auth]", error);
    return NextResponse.json(
      { error: "Realtime location is unavailable." },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}
