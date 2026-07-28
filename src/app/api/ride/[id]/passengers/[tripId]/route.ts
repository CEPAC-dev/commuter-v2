import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import {
  updatePassengerStatusInRide,
  removePassengerFromRide,
} from "@/lib/services/rideService";

// PATCH /api/rides/:id/passengers/:tripId — update one passenger's status
export async function PATCH(
  req: NextRequest,
  { params }: { params: any },
) {
  try {
    await connectDB();
    const { status } = await req.json();
    if (!status) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 },
      );
    }
    const ride = await updatePassengerStatusInRide(
      params.id,
      params.tripId,
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
  { params }: { params: any },
) {
  try {
    await connectDB();
    const { reason } = await req.json().catch(() => ({ reason: undefined }));
    const ride = await removePassengerFromRide(
      params.id,
      params.tripId,
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
