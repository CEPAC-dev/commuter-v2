import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Station } from "@/models/Station";
import {
  RegionAccessError,
  resolveActiveRegion,
} from "@/lib/regions/resolveActiveRegion";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { StationAuditLog } from "@/models/StationAuditLog";
import { PERMISSIONS } from "@/lib/auth/permissions";

interface StationSource {
  objectId?: number;
  name?: string;
  direction?: string;
  zones?: string;
  description?: string;
  landmark?: string;
  stationType?: string;
  lat?: number;
  lng?: number;
}

function serialize(s: StationSource) {
  return {
    id: s.objectId,
    name: s.name || s.direction || "",
    direction: s.direction,
    zones: s.zones || "",
    description: s.description || "",
    landmark: s.landmark || "",
    stationType: s.stationType,
    lat: s.lat,
    lng: s.lng,
    popupInfo: [s.description, s.direction, s.landmark, s.stationType]
      .filter(Boolean)
      .join("\n"),
  };
}

// Public — used by the map to list active station points or fetch a single station by query
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const stationId = url.searchParams.get("stationId");
  const stationNumber = url.searchParams.get("stationNumber");
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let region;
  try {
    region = await resolveActiveRegion({
      userId: session.userId,
      requested: url.searchParams.get("region"),
    });
  } catch (error) {
    const status = error instanceof RegionAccessError ? error.status : 403;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Region access denied.",
      },
      { status },
    );
  }

  await connectDB();

  if (stationId) {
    const station = await Station.findOne({
      _id: stationId,
      regionCode: region.code,
    }).lean();
    if (!station) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }
    return NextResponse.json({ station: serialize(station) });
  }

  if (stationNumber) {
    const objectId = Number(stationNumber);
    if (!Number.isFinite(objectId)) {
      return NextResponse.json(
        { error: "Invalid stationNumber" },
        { status: 400 },
      );
    }

    const station = await Station.findOne({
      objectId,
      regionCode: region.code,
    }).lean();
    if (!station) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }
    return NextResponse.json({ station: serialize(station) });
  }

  const stations = await Station.find({
    regionCode: region.code,
    active: true,
  }).lean();
  return NextResponse.json({ stations: stations.map(serialize) });
}

// Admin — create a single station point
export async function POST(req: NextRequest) {
  const auth = await adminAuth(
    PERMISSIONS.STATIONS_MANAGE,
    req.nextUrl.searchParams.get("region"),
  );
  if (!auth.authorized) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Invalid lat/lng" }, { status: 400 });
  }

  await connectDB();

  const objectId = Number(body.objectId ?? body.sourceObjectId);
  if (!Number.isInteger(objectId) || objectId < 0) {
    return NextResponse.json({ error: "A non-negative objectId is required." }, { status: 400 });
  }
  const duplicate = await Station.exists({ objectId });
  if (duplicate) return NextResponse.json({ error: "objectId already exists; the legacy global identity index remains in force." }, { status: 409 });

  const station = await Station.create({
    objectId,
    sourceObjectId: objectId,
    sourceKind: "manual",
    name: String(body.name ?? ""),
    direction: String(body.direction ?? ""),
    zones: String(body.zones ?? ""),
    description: String(body.description ?? ""),
    stationType: String(body.stationType ?? ""),
    landmark: String(body.landmark ?? ""),
    lat,
    lng,
    active: body.active !== false,
    regionCode: auth.region.code,
  });

  await StationAuditLog.create({
    action: "manual_create",
    regionCode: auth.region.code,
    actorId: auth.userId,
    stationId: station._id,
    metadata: { objectId: station.objectId, after: station.toObject() },
  });

  return NextResponse.json({ station: serialize(station) }, { status: 201 });
}
