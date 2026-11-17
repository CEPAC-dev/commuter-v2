import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { createTripLocationTokenRequest } from "@/lib/liveLocation/ably";
import { canShare } from "@/lib/liveShare/eligibility";
import { logLiveShareFailure } from "@/lib/liveShare/errors";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "passenger" && session.role !== "driver") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  try {
    await connectDB();
    const ownerFilter =
      session.role === "driver"
        ? { driverId: session.userId }
        : { userId: session.userId };
    const trip = await Trip.findOne({ _id: id, ...ownerFilter })
      .select("_id userId driverId status rideId")
      .lean();
    if (!trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }
    const ride = trip.rideId
      ? await Ride.findById(trip.rideId).select("status driverId").lean()
      : null;
    const authorized =
      session.role === "driver"
        ? trip.status === "active" || ride?.status === "active"
        : canShare(trip, session.userId, ride);
    if (!authorized) {
      return NextResponse.json({ error: "Trip is not live." }, { status: 404 });
    }

    const tokenRequest = await createTripLocationTokenRequest(
      String(trip._id),
      `${session.role}:${session.userId}`,
    );
    return NextResponse.json(tokenRequest, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    logLiveShareFailure("[GET /api/trips/[id]/live/auth]", error);
    return NextResponse.json(
      { error: "Realtime location is unavailable." },
      { status: 503 },
    );
  }
}
