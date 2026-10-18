import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { getRideCancellationAccess } from "@/lib/rideCancellationAccess";
import { Ride } from "@/models/Ride";
import {
  updatePassengerStatusInRide,
  removePassengerFromRide,
} from "@/lib/services/rideService";

// PATCH /api/rides/:id/passengers/:tripId — update one passenger's status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tripId: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, tripId } = await params;
    await connectDB();
    const rideOwner = await Ride.findById(id).select("driverId").lean();
    if (!rideOwner) {
      return NextResponse.json({ error: "Ride not found" }, { status: 404 });
    }
    const access = getRideCancellationAccess(session, rideOwner.driverId);
    if (access !== "admin" && access !== "driver") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { status } = await req.json();
    if (!status) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 },
      );
    }
    const ride = await updatePassengerStatusInRide(
      id,
      tripId,
      status,
    );
    if (!ride) {
      return NextResponse.json(
        { error: "Ride or passenger not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: ride });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update passenger status" },
      { status: 400 },
    );
  }
}

// DELETE /api/rides/:id/passengers/:tripId — remove a passenger from the ride
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tripId: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, tripId } = await params;
    await connectDB();
    const rideOwner = await Ride.findById(id).select("driverId").lean();
    if (!rideOwner) {
      return NextResponse.json({ error: "Ride not found" }, { status: 404 });
    }
    const access = getRideCancellationAccess(session, rideOwner.driverId);
    if (access !== "admin" && access !== "driver") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { reason } = await req.json().catch(() => ({ reason: undefined }));
    const ride = await removePassengerFromRide(
      id,
      tripId,
      reason,
    );
    return NextResponse.json({ data: ride });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to remove passenger" },
      { status: 400 },
    );
  }
}
