import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { buildAssignedDriver } from "@/lib/services/trips";
import { createNotification } from "@/lib/notifications/createNotification";
import { Driver } from "@/models/Driver";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";

/**
 * PATCH /api/admin/rides/:id/reassign
 * Body: { driverId: string }
 * Admin manual-assign escape hatch for rides broadcast with zero eligible
 * drivers (needsManualAssignment). Force-assigns a driver directly instead
 * of relying on the accept/reject offer flow.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ride id." }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as {
    driverId?: unknown;
  } | null;
  const driverId = String(body?.driverId ?? "");
  if (!isValidObjectId(driverId)) {
    return NextResponse.json({ error: "driverId is required." }, { status: 400 });
  }

  await connectDB();

  const ride = await Ride.findById(id);
  if (!ride) {
    return NextResponse.json({ error: "Ride not found." }, { status: 404 });
  }
  if (ride.status === "completed" || ride.status === "cancelled") {
    return NextResponse.json(
      { error: `Cannot assign a driver to a ${ride.status} ride.` },
      { status: 409 },
    );
  }

  const driverUser = await User.findOne({ _id: driverId, role: "driver" })
    .select("_id")
    .lean();
  if (!driverUser) {
    return NextResponse.json({ error: "Driver not found." }, { status: 404 });
  }
  const driverProfile = await Driver.findOne({ userId: driverId })
    .select("verificationStatus")
    .lean<{ verificationStatus?: string }>();
  if (driverProfile?.verificationStatus !== "verified") {
    return NextResponse.json(
      { error: "Driver must be verified before being assigned a ride." },
      { status: 409 },
    );
  }

  const assignedDriver = await buildAssignedDriver(driverId);
  if (!assignedDriver) {
    return NextResponse.json(
      { error: "Could not resolve the driver's profile." },
      { status: 404 },
    );
  }

  ride.driverId = driverId as unknown as typeof ride.driverId;
  ride.assignedDriver = assignedDriver;
  ride.offeredToDriverIds = [];
  ride.needsManualAssignment = false;
  if (ride.status === "matched") ride.status = "confirmed";
  await ride.save();

  const tripIds = (ride.passengers as unknown as Array<{ tripId?: unknown }>)
    .map((passenger) => passenger.tripId)
    .filter(Boolean);
  await Trip.updateMany(
    { _id: { $in: tripIds }, rideId: ride._id },
    { $set: { driverId, assignedDriver, status: "confirmed" } },
  );

  await createNotification({
    userId: driverId,
    type: "driver_assigned",
    title: "You've been assigned a ride",
    body: `${ride.date} at ${ride.startTime} · ${ride.totalCost} EGP`,
    data: { rideId: String(ride._id) },
  });

  return NextResponse.json({ ok: true });
}

