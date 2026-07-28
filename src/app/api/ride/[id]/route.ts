import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import {
  getRideById,
  updateRideStatus,
  cancelRide,
} from "@/lib/services/rideService";

// GET /api/rides/:id
export async function GET(_req: NextRequest, { params }: { params: any }) {
  try {
    await connectDB();
    const ride = await getRideById(params.id);
    if (!ride) {
      return NextResponse.json({ error: "Ride not found" }, { status: 404 });
    }
    return NextResponse.json({ data: ride });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch ride" },
      { status: 500 },
    );
  }
}

// PATCH /api/rides/:id — update ride status (confirmed/active/completed)
export async function PATCH(req: NextRequest, { params }: { params: any }) {
  try {
    await connectDB();
    const { status } = await req.json();
    if (!status) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 },
      );
    }
    const ride = await updateRideStatus(params.id, status);
    if (!ride) {
      return NextResponse.json({ error: "Ride not found" }, { status: 404 });
    }
    return NextResponse.json({ data: ride });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update ride" },
      { status: 400 },
    );
  }
}

// DELETE /api/rides/:id — cancel (never hard delete)
export async function DELETE(req: NextRequest, { params }: { params: any }) {
  try {
    await connectDB();
    const { reason } = await req.json().catch(() => ({ reason: undefined }));
    const ride = await cancelRide(params.id, reason);
    return NextResponse.json({ data: ride });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to cancel ride" },
      { status: 400 },
    );
  }
}
