import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await connectDB();

  const trip = await Trip.findById(id)
    .populate("requestId")
    .populate("userId", "name email phone role")
    .populate("driverId", "name email phone role")
    .populate("rideId")
    .lean();

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  return NextResponse.json({ trip });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await connectDB();

  const deleted = await Trip.findByIdAndDelete(id);
  if (!deleted) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
