import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { buildAssignedDriver } from "@/lib/services/trips";
import { Availability } from "@/models/Availability";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";

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
    availabilityId?: unknown;
  } | null;
  const availabilityId = String(body?.availabilityId ?? "");
  if (!isValidObjectId(availabilityId)) {
    return NextResponse.json(
      { error: "availabilityId is required." },
      { status: 400 },
    );
  }

  await connectDB();

  const ride = await Ride.findById(id);
  if (!ride) {
    return NextResponse.json({ error: "Ride not found." }, { status: 404 });
  }
  if (ride.status !== "matched") {
    return NextResponse.json(
      { error: "Only rides with status 'matched' can be reassigned." },
      { status: 409 },
    );
  }

  const availability = await Availability.findById(availabilityId);
  if (!availability) {
    return NextResponse.json(
      { error: "Availability not found." },
      { status: 404 },
    );
  }
  if (availability.date !== ride.date) {
    return NextResponse.json(
      { error: "Availability date does not match the ride date." },
      { status: 400 },
    );
  }
  if (!availability.driverId) {
    return NextResponse.json(
      { error: "Availability has no driver attached." },
      { status: 400 },
    );
  }

  const driverId = availability.driverId;
  const assignedDriver = await buildAssignedDriver(driverId);
  if (!assignedDriver) {
    return NextResponse.json(
      { error: "Could not resolve the driver of this availability." },
      { status: 404 },
    );
  }

  const previousAvailabilityId = ride.availabilityId
    ? String(ride.availabilityId)
    : null;

  ride.availabilityId = availability._id;
  ride.driverId = driverId;
  ride.assignedDriver = assignedDriver;
  await ride.save();

  // `details` is a Mixed field that defaults to null — seed it before writing a dotted path.
  await Trip.updateMany(
    {
      rideId: ride._id,
      $or: [{ details: null }, { details: { $exists: false } }],
    },
    { $set: { details: {} } },
  );
  await Trip.updateMany(
    { rideId: ride._id },
    {
      $set: {
        driverId,
        assignedDriver,
        "details.availabilityId": availability._id,
      },
    },
  );

  if (previousAvailabilityId && previousAvailabilityId !== availabilityId) {
    await Availability.findByIdAndUpdate(previousAvailabilityId, {
      $set: { matched: false, rideId: null, status: "open" },
    });
  }

  availability.matched = true;
  availability.rideId = ride._id;
  availability.status = "matched";
  await availability.save();

  return NextResponse.json({ ok: true });
}
