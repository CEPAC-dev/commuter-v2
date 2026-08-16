import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";

const ALLOWED_KEYS = [
  "private_car",
  "taxi_private",
  "taxi_shared",
  "shared_car",
  "van_shared",
  "microbus_shared",
];
const ALLOWED_RIDE = ["private", "shared"];

export async function GET() {
  await connectDB();
  const vehicles = await Vehicle.find({ active: true })
    .sort({ sortOrder: 1 })
    .select(
      "key label rate ride buffer window capacity occupancy min_occupancy active",
    )
    .lean();
  return NextResponse.json({ vehicles });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const key = String(body.key ?? "");
  const ride = String(body.ride ?? "");
  if (!ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }
  if (!ALLOWED_RIDE.includes(ride)) {
    return NextResponse.json({ error: "Invalid ride" }, { status: 400 });
  }

  const label = String(body.label ?? "");
  const rate = Number(body.rate);
  const buffer = Number(body.buffer);
  const windowMin = Number(body.window);
  const capacity = Math.round(Number(body.capacity));
  const occupancy = Math.round(Number(body.occupancy ?? 0));
  const minOccupancy = Math.round(Number(body.min_occupancy));

  if (
    !label ||
    !isFinite(rate) ||
    !isFinite(buffer) ||
    !isFinite(windowMin) ||
    !isFinite(capacity) ||
    !isFinite(minOccupancy)
  ) {
    return NextResponse.json(
      { error: "Invalid vehicle fields" },
      { status: 400 },
    );
  }

  await connectDB();

  const existing = await Vehicle.findOne({ key });
  if (existing) {
    return NextResponse.json(
      { error: "Vehicle key already exists" },
      { status: 409 },
    );
  }

  const vehicle = await Vehicle.create({
    key,
    label,
    rate,
    ride,
    buffer,
    window: windowMin,
    capacity,
    occupancy,
    min_occupancy: minOccupancy,
    active: true,
  });

  return NextResponse.json(
    {
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
    },
    { status: 201 },
  );
}
