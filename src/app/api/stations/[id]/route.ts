import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Station } from "@/models/Station";
import { StationAuditLog } from "@/models/StationAuditLog";
import { StationOverride } from "@/models/StationOverride";
import { PERMISSIONS } from "@/lib/auth/permissions";

// Admin — update a station point (by its objectId, not Mongo _id)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(
    PERMISSIONS.STATIONS_MANAGE,
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

  if (patch.lat !== undefined && (Number(patch.lat) < -90 || Number(patch.lat) > 90) || patch.lng !== undefined && (Number(patch.lng) < -180 || Number(patch.lng) > 180)) return NextResponse.json({ error: "Coordinates are outside valid ranges." }, { status: 400 });
  await connectDB();
  const before = await Station.findOne({ objectId, regionCode: auth.region.code });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const station = await Station.findByIdAndUpdate(before._id, { $set: patch }, { returnDocument: "after" });
  await StationOverride.findOneAndUpdate(
    { regionCode: auth.region.code, objectId },
    { $set: { stationId: before._id, fields: patch, actorId: auth.userId, sourceRemoved: false } },
    { upsert: true },
  );

  await StationAuditLog.create({
    action: "manual_update",
    regionCode: auth.region.code,
    actorId: auth.userId,
    stationId: before._id,
    metadata: { objectId, fields: Object.keys(patch), before: before.toObject(), after: station?.toObject() },
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
    PERMISSIONS.STATIONS_MANAGE,
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
    action: "manual_deactivate",
    regionCode: auth.region.code,
    actorId: auth.userId,
    stationId: station._id,
    metadata: { objectId, softDeactivate: true },
  });

  return NextResponse.json({ ok: true });
}
