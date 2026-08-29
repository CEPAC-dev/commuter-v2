import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Station } from "@/models/Station";

// Admin — update a station point (by its objectId, not Mongo _id)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const objectId = Number(id);
  if (!isFinite(objectId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = String(body.name);
  if (body.direction !== undefined) patch.direction = String(body.direction);
  if (body.zones !== undefined) patch.zones = String(body.zones);
  if (body.description !== undefined)
    patch.description = String(body.description);
  if (body.landmark !== undefined) patch.landmark = String(body.landmark);
  if (body.stationType !== undefined)
    patch.stationType = String(body.stationType);
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.lat !== undefined) {
    const lat = Number(body.lat);
    if (!isFinite(lat))
      return NextResponse.json({ error: "Invalid lat" }, { status: 400 });
    patch.lat = lat;
  }
  if (body.lng !== undefined) {
    const lng = Number(body.lng);
    if (!isFinite(lng))
      return NextResponse.json({ error: "Invalid lng" }, { status: 400 });
    patch.lng = lng;
  }

  await connectDB();
  const station = await Station.findOneAndUpdate(
    { objectId },
    { $set: patch },
    { returnDocument: "after" },
  );
  if (!station)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    station: {
      id: station.objectId,
      name: station.name,
      direction: station.direction,
      stationType: station.stationType,
      lat: station.lat,
      lng: station.lng,
    },
  });
}

// Admin — remove a station point
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const objectId = Number(id);
  if (!isFinite(objectId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();
  const res = await Station.deleteOne({ objectId });
  if (res.deletedCount === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
