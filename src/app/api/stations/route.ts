import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Station } from "@/models/Station";

function serialize(s: any) {
  return {
    id: s.objectId,
    name: s.name || s.direction || "",
    direction: s.direction,
    stationType: s.stationType,
    lat: s.lat,
    lng: s.lng,
    popupInfo: [s.direction, s.landmark, s.stationType]
      .filter(Boolean)
      .join("\n"),
  };
}

// Public — used by the map to list active station points or fetch a single station by query
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const stationId = url.searchParams.get("stationId");
  const stationNumber = url.searchParams.get("stationNumber");

  await connectDB();

  if (stationId) {
    const station = await Station.findById(stationId).lean();
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

    const station = await Station.findOne({ objectId }).lean();
    if (!station) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }
    return NextResponse.json({ station: serialize(station) });
  }

  const stations = await Station.find({ active: true }).lean();
  return NextResponse.json({ stations: stations.map(serialize) });
}

// Admin — create a single station point
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

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: "Invalid lat/lng" }, { status: 400 });
  }

  await connectDB();

  const maxDoc = await Station.findOne()
    .sort({ objectId: -1 })
    .select("objectId");
  const nextObjectId = (maxDoc?.objectId ?? 0) + 1;

  const station = await Station.create({
    objectId: nextObjectId,
    name: String(body.name ?? ""),
    direction: String(body.direction ?? ""),
    stationType: String(body.stationType ?? ""),
    landmark: String(body.landmark ?? ""),
    lat,
    lng,
    active: body.active !== false,
  });

  return NextResponse.json({ station: serialize(station) }, { status: 201 });
}
