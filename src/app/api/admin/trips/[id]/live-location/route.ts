import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { logLiveShareFailure } from "@/lib/liveShare/errors";
import { readDriverLocation } from "@/lib/liveLocation/store";
import { Trip } from "@/models/Trip";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  try {
    const trip = await Trip.findById(id).select("_id status rideId").lean();
    if (!trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }
    if (trip.status !== "active") {
      return NextResponse.json(
        { active: false, location: null },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const location = await readDriverLocation(
      trip.rideId ? "ride" : "trip",
      String(trip.rideId ?? trip._id),
    );
    return NextResponse.json(
      { active: true, location },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    logLiveShareFailure("[GET /api/admin/trips/[id]/live-location]", error);
    return NextResponse.json(
      { error: "Unable to load driver location." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
