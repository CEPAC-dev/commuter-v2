import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { getSession } from "@/lib/auth/session";
import {
  getDriverRideCancellationDecision,
  getRideCancellationAccess,
} from "@/lib/rideCancellationAccess";
import { Ride } from "@/models/Ride";
import {
  getRideById,
  updateRideStatus,
  cancelRide,
  cancelRideByDriver,
} from "@/lib/services/rideService";

// GET /api/rides/:id
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();
    const rideOwner = await Ride.findById(id).select("driverId").lean();
    if (!rideOwner) {
      return NextResponse.json({ error: "Ride not found" }, { status: 404 });
    }
    const access = getRideCancellationAccess(session, rideOwner.driverId);
    if (access !== "admin" && access !== "driver") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ride = await getRideById(id);
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
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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
    const ride = await updateRideStatus(id, status);
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
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const access = getRideCancellationAccess(session, null);

    const { id } = await params;
    await connectDB();
    const { reason } = await req.json().catch(() => ({ reason: undefined }));

    if (access === "admin") {
      const result = await cancelRide(id, reason);
      return NextResponse.json({
        data: result.ride,
        preservedTripIds: result.preservedTripIds,
      });
    }

    if (session.role !== "driver") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rideOwner = await Ride.findById(id)
      .select("driverId status")
      .lean();
    if (!rideOwner) {
      return NextResponse.json({ error: "Ride not found" }, { status: 404 });
    }
    const driverAccess = getRideCancellationAccess(session, rideOwner.driverId);
    if (driverAccess !== "driver") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (
      getDriverRideCancellationDecision(driverAccess, rideOwner.status) ===
      "use_incident_report"
    ) {
      return NextResponse.json(
        {
          errorCode: "USE_INCIDENT_REPORT",
          error: "Active rides must report a problem instead of cancelling.",
        },
        { status: 409 },
      );
    }

    const ride = await cancelRideByDriver(id, session.userId, reason);
    return NextResponse.json({ data: ride });
  } catch (err: any) {
    if (err?.message === "USE_INCIDENT_REPORT") {
      return NextResponse.json(
        {
          errorCode: "USE_INCIDENT_REPORT",
          error: "Active rides must report a problem instead of cancelling.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: err.message || "Failed to cancel ride" },
      { status: 400 },
    );
  }
}
