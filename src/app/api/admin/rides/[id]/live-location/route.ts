import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { readDriverLocation } from "@/lib/liveLocation/store";
import { logLiveShareFailure } from "@/lib/liveShare/errors";
import { Ride } from "@/models/Ride";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Ride not found." }, { status: 404 });
  }

  try {
    const ride = await Ride.findById(id).select("_id status").lean();
    if (!ride) {
      return NextResponse.json({ error: "Ride not found." }, { status: 404 });
    }
    if (ride.status !== "active") {
      return NextResponse.json(
        { active: false, location: null },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const location = await readDriverLocation("ride", String(ride._id));
    return NextResponse.json(
      { active: true, location },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    logLiveShareFailure("[GET /api/admin/rides/[id]/live-location]", error);
    return NextResponse.json(
      { error: "Unable to load driver location." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
