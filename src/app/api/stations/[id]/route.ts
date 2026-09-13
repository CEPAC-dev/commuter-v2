import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Station } from "@/models/Station";
import { StationAuditLog } from "@/models/StationAuditLog";

// Admin — update a station point (by its objectId, not Mongo _id)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(
    undefined,
    req.nextUrl.searchParams.get("region"),
  );
  if (!auth.authorized) return auth.response;

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
    { objectId, regionCode: auth.region.code },
    { $set: patch },
    { returnDocument: "after" },
  );
  if (!station)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await StationAuditLog.create({
    action: "manual_update",
    regionCode: auth.region.code,
    actorId: auth.userId,
    metadata: { objectId, fields: Object.keys(patch) },
  });

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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(
    undefined,
    req.nextUrl.searchParams.get("region"),
  );
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  const objectId = Number(id);
  if (!isFinite(objectId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();
  const station = await Station.findOneAndUpdate(
    { objectId, regionCode: auth.region.code },
    { $set: { active: false } },
  );
  if (!station)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await StationAuditLog.create({
    action: "manual_delete",
    regionCode: auth.region.code,
    actorId: auth.userId,
    metadata: { objectId, softDelete: true },
  });

  return NextResponse.json({ ok: true });
}
