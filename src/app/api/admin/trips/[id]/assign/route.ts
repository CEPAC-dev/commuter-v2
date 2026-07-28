import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Availability } from "@/models/Availability";
import { User } from "@/models/User";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  const { driverId } = await req.json();

  if (!driverId) {
    return NextResponse.json({ error: "driverId is required" }, { status: 400 });
  }

  await connectDB();

  const trip = await Trip.findById(id);
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const driver = await User.findOne({ _id: driverId, role: "driver" }).lean<{
    _id?: unknown;
  }>();
  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  const availability = await Availability.findOne({
    driverId,
    date: trip.date,
  }).lean<{
    startTime?: string;
    endTime?: string;
  }>();

  if (!availability) {
    return NextResponse.json({ error: "Driver is not available for this date" }, { status: 409 });
  }

  trip.driverId = driverId;
  trip.status = "active";
  await trip.save();

  return NextResponse.json({ ok: true, trip });
}
