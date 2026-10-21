import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { isRegionCode, type RegionCode } from "@/lib/config/regions";
import type { ZoneFeature } from "@/lib/geo/zones";
import { getServiceZoneConfig } from "@/lib/geo/zones.server";
import { ZoneDataset } from "@/models/ZoneDataset";
import { validateMutationRequest } from "@/lib/security/request";

const MAX_GEOJSON_BYTES = 8 * 1024 * 1024;
const MAX_FEATURES = 5000;
const MAX_POSITIONS = 250_000;

type Position = [number, number];
type Ring = Position[];

function isPosition(value: unknown): value is Position {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1]) &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

function isRing(value: unknown): value is Ring {
  return (
    Array.isArray(value) &&
    value.length >= 4 &&
    value.every(isPosition) &&
    value[0][0] === value[value.length - 1][0] &&
    value[0][1] === value[value.length - 1][1]
  );
}

function isPolygonCoordinates(value: unknown): value is Ring[] {
  return Array.isArray(value) && value.length > 0 && value.every(isRing);
}

function isValidGeometry(feature: Record<string, unknown>): boolean {
  const geometry = feature.geometry;
  if (!geometry || typeof geometry !== "object") return false;
  const shape = geometry as Record<string, unknown>;
  if (shape.type === "Polygon") return isPolygonCoordinates(shape.coordinates);
  if (shape.type === "MultiPolygon") {
    return (
      Array.isArray(shape.coordinates) &&
      shape.coordinates.length > 0 &&
      shape.coordinates.every(isPolygonCoordinates)
    );
  }
  return false;
}

function countPositions(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  if (value.length >= 2 && typeof value[0] === "number") return 1;
  return value.reduce<number>((count, item) => count + countPositions(item), 0);
}

function normalizeFeatures(value: unknown): ZoneFeature[] | null {
  if (!value || typeof value !== "object") return null;
  const collection = value as { type?: unknown; features?: unknown };
  if (
    collection.type !== "FeatureCollection" ||
    !Array.isArray(collection.features) ||
    collection.features.length === 0 ||
    collection.features.length > MAX_FEATURES
  ) {
    return null;
  }

  const features: ZoneFeature[] = [];
  const ids = new Set<string>();
  let positionCount = 0;
  for (const [index, valueFeature] of collection.features.entries()) {
    if (!valueFeature || typeof valueFeature !== "object") return null;
    const feature = valueFeature as Record<string, unknown>;
    if (feature.type !== "Feature" || !isValidGeometry(feature)) return null;
    const geometry = feature.geometry as Record<string, unknown>;
    positionCount += countPositions(geometry.coordinates);
    if (positionCount > MAX_POSITIONS) return null;

    const properties =
      feature.properties && typeof feature.properties === "object"
        ? (feature.properties as Record<string, unknown>)
        : {};
    const rawId = feature.id;
    const id =
      typeof rawId === "string" || typeof rawId === "number"
        ? String(rawId).trim()
        : `ZONE-${index + 1}`;
    if (!id || ids.has(id)) return null;
    ids.add(id);
    const name =
      typeof properties.NAME === "string" && properties.NAME.trim()
        ? properties.NAME.trim().slice(0, 160)
        : `Zone ${index + 1}`;
    features.push({
      type: "Feature",
      id,
      properties: { ...properties, NAME: name } as { NAME?: string },
      geometry: geometry as ZoneFeature["geometry"],
    });
  }
  return features;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const regionCode = request.nextUrl.searchParams.get("regionCode");
  if (!isRegionCode(regionCode)) {
    return NextResponse.json({ error: "Invalid region." }, { status: 400 });
  }

  return NextResponse.json(await getServiceZoneConfig(regionCode));
}

export async function PUT(request: NextRequest) {
  const invalidRequest = validateMutationRequest(request, {
    maxBytes: MAX_GEOJSON_BYTES,
  });
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_GEOJSON_BYTES) {
      return NextResponse.json(
        { error: "Zone GeoJSON exceeds the 8MB limit." },
        { status: 413 },
      );
    }
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const regionCode = body.regionCode;
    if (!isRegionCode(regionCode)) {
      return NextResponse.json({ error: "Invalid region." }, { status: 400 });
    }
    const features = normalizeFeatures(body.geojson);
    if (!features) {
      return NextResponse.json(
        {
          error:
            "Upload a valid GeoJSON FeatureCollection containing Polygon or MultiPolygon features with closed rings and unique feature IDs.",
        },
        { status: 400 },
      );
    }
    const sourceName =
      typeof body.sourceName === "string" && body.sourceName.trim()
        ? body.sourceName.trim().slice(0, 160)
        : "admin-upload.geojson";

    await connectDB();
    const data = await ZoneDataset.findOneAndUpdate(
      { regionCode: regionCode as RegionCode },
      {
        $set: {
          regionCode,
          sourceName,
          features,
          featureCount: features.length,
          updatedBy: session.userId,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).lean();
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save zone configuration.",
      },
      { status: 500 },
    );
  }
}
