import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Station } from "@/models/Station";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

interface RawFeature {
  id?: number;
  geometry?: { type?: string; coordinates?: [number, number] };
  properties?: {
    OBJECTID?: number;
    name?: string;
    direction?: string;
    station_type?: string;
    landmark?: string;
  };
}

// Admin — upload a GeoJSON/JSON file matching the PT910 station-points
// structure ({type:"FeatureCollection", features:[{id, geometry:{type:"Point",
// coordinates:[lng,lat]}, properties:{OBJECTID,name,direction,landmark,station_type}}]}).
// Fully REPLACES the station points collection with the uploaded data.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "passenger") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let file: File | null = null;
  try {
    const formData = await req.formData();
    const f = formData.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Max 5MB." },
      { status: 400 },
    );
  }

  let parsed: { type?: string; features?: RawFeature[] };
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON/GeoJSON file" },
      { status: 400 },
    );
  }

  if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    return NextResponse.json(
      { error: "Expected a GeoJSON FeatureCollection" },
      { status: 400 },
    );
  }

  const docs: Record<string, unknown>[] = [];
  for (const [i, f] of parsed.features.entries()) {
    const coords = f.geometry?.coordinates;
    if (
      f.geometry?.type !== "Point" ||
      !Array.isArray(coords) ||
      coords.length < 2
    ) {
      return NextResponse.json(
        { error: `Feature ${i}: expected Point geometry with [lng, lat]` },
        { status: 400 },
      );
    }
    const [lng, lat] = coords;
    if (!isFinite(lat) || !isFinite(lng)) {
      return NextResponse.json(
        { error: `Feature ${i}: invalid coordinates` },
        { status: 400 },
      );
    }
    const objectId = f.properties?.OBJECTID ?? f.id;
    if (typeof objectId !== "number" || !isFinite(objectId)) {
      return NextResponse.json(
        { error: `Feature ${i}: missing OBJECTID / id` },
        { status: 400 },
      );
    }
    docs.push({
      objectId,
      name: String(f.properties?.name ?? ""),
      direction: String(f.properties?.direction ?? ""),
      landmark: String(f.properties?.landmark ?? ""),
      stationType: String(f.properties?.station_type ?? ""),
      lat,
      lng,
      active: true,
    });
  }

  if (docs.length === 0) {
    return NextResponse.json({ error: "No features found" }, { status: 400 });
  }

  await connectDB();

  // Full override — wipe existing station points, insert the uploaded set
  await Station.deleteMany({});
  await Station.insertMany(docs);

  return NextResponse.json({ ok: true, count: docs.length }, { status: 201 });
}
