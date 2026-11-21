import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { isRegionCode } from "@/lib/config/regions";
import { OperatingCity } from "@/models/OperatingCity";
import { Station } from "@/models/Station";
import { validateMutationRequest } from "@/lib/security/request";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cityCode: string }> },
) {
  const invalid = validateMutationRequest(request);
  if (invalid) return invalid;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const value = body as Record<string, unknown>;
  if (!isRegionCode(value.regionCode)) {
    return NextResponse.json({ error: "Choose a valid Region." }, { status: 400 });
  }
  const auth = await adminAuth(undefined, value.regionCode);
  if (!auth.authorized) return auth.response;
  const { cityCode } = await params;
  const update: Record<string, unknown> = {};
  for (const field of ["name", "nameAr", "timezone"] as const) {
    if (value[field] !== undefined) {
      if (typeof value[field] !== "string" || !value[field].trim()) {
        return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
      }
      update[field] = value[field].trim();
    }
  }
  if (value.active !== undefined) {
    if (typeof value.active !== "boolean") {
      return NextResponse.json({ error: "Invalid active flag." }, { status: 400 });
    }
    if (value.active) {
      const currentCity = await OperatingCity.findOne({
        regionCode: value.regionCode,
        cityCode,
      }).select("isCapital zoneFeatures");
      if (!currentCity) {
        return NextResponse.json({ error: "City/State not found." }, { status: 404 });
      }
      if (!currentCity.isCapital) {
        const [stationCount, zoneCount] = await Promise.all([
          Station.countDocuments({ regionCode: value.regionCode, cityCode }),
          Promise.resolve(currentCity.zoneFeatures?.length ?? 0),
        ]);
        if (stationCount === 0 || zoneCount === 0) {
          return NextResponse.json(
            { error: "Configure at least one station and a service zone before activation." },
            { status: 409 },
          );
        }
      }
    }
    update.active = value.active;
  }
  if (value.zoneFeatures !== undefined) {
    if (
      !Array.isArray(value.zoneFeatures) ||
      value.zoneFeatures.length === 0 ||
      value.zoneFeatures.some((feature) => {
        if (!feature || typeof feature !== "object" || Array.isArray(feature)) {
          return true;
        }
        const geometry = (feature as { geometry?: unknown }).geometry;
        if (!geometry || typeof geometry !== "object" || Array.isArray(geometry)) {
          return true;
        }
        const shape = geometry as { type?: unknown; coordinates?: unknown };
        return (
          !["Polygon", "MultiPolygon"].includes(String(shape.type)) ||
          !Array.isArray(shape.coordinates)
        );
      })
    ) {
      return NextResponse.json(
        { error: "Provide at least one valid Polygon or MultiPolygon service zone." },
        { status: 400 },
      );
    }
    update.zoneFeatures = value.zoneFeatures;
  }
  const city = await OperatingCity.findOneAndUpdate(
    { regionCode: value.regionCode, cityCode },
    { $set: update },
    { returnDocument: "after", runValidators: true },
  );
  if (!city) return NextResponse.json({ error: "City/State not found." }, { status: 404 });
  return NextResponse.json({ city });
}
