import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  await connectDB();
  const vehicle = await Vehicle.findOne({ key })
    .select(
      "key label rate ride buffer window capacity occupancy min_occupancy active",
    )
    .lean();
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }
  return NextResponse.json(vehicle);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { key } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.label !== undefined) update.label = String(body.label);
  if (body.rate !== undefined) update.rate = Number(body.rate);
  if (body.ride !== undefined) {
    if (!["private", "shared"].includes(String(body.ride))) {
      return NextResponse.json({ error: "Invalid ride" }, { status: 400 });
    }
    update.ride = String(body.ride);
  }
  if (body.buffer !== undefined) update.buffer = Number(body.buffer);
  if (body.window !== undefined) update.window = Number(body.window);
  if (body.capacity !== undefined)
    update.capacity = Math.round(Number(body.capacity));
  if (body.occupancy !== undefined)
    update.occupancy = Math.round(Number(body.occupancy));
  if (body.min_occupancy !== undefined)
    update.min_occupancy = Math.round(Number(body.min_occupancy));
  if (body.active !== undefined) update.active = Boolean(body.active);

  for (const k of [
    "rate",
    "buffer",
    "window",
    "capacity",
    "occupancy",
    "min_occupancy",
  ]) {
    if (update[k] !== undefined && !isFinite(update[k] as number)) {
      return NextResponse.json({ error: `Invalid ${k}` }, { status: 400 });
    }
  }

  await connectDB();
  const vehicle = await Vehicle.findOneAndUpdate({ key }, update, {
    returnDocument: "after",
  });
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  return NextResponse.json({
    key: vehicle.key,
    label: vehicle.label,
    rate: vehicle.rate,
    ride: vehicle.ride,
    buffer: vehicle.buffer,
    window: vehicle.window,
    capacity: vehicle.capacity,
    occupancy: vehicle.occupancy,
    min_occupancy: vehicle.min_occupancy,
    active: vehicle.active,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { key } = await params;
  await connectDB();
  const result = await Vehicle.findOneAndDelete({ key });
  if (!result) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
