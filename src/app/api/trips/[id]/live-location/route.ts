import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { canShare } from "@/lib/liveShare/eligibility";
import { logLiveShareFailure } from "@/lib/liveShare/errors";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { readDriverLocation } from "@/lib/liveLocation/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "passenger") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  try {
    await connectDB();
    const trip = await Trip.findOne({ _id: id, userId: session.userId })
      .select("_id userId driverId status rideId pickup dropoff")
      .lean();
    if (!trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    const ride = trip.rideId
      ? await Ride.findById(trip.rideId).select("status driverId").lean()
      : null;
    const active = trip.status === "active" || ride?.status === "active";
    if (!canShare(trip, session.userId, ride) || !active) {
      return NextResponse.json(
        { active: false, driverLocation: null },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const location = await readDriverLocation(
      trip.rideId ? "ride" : "trip",
      String(trip.rideId ?? trip._id),
    );
    return NextResponse.json(
      { active: true, driverLocation: location },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    logLiveShareFailure("[GET /api/trips/[id]/live-location]", error);
    return NextResponse.json(
      { error: "Unable to load driver location." },
      { status: 500 },
    );
  }
}
