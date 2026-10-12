import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import {
  defaultMapSettings,
  type MapCanvasStyle,
  type MapProviderName,
  type StationAssignmentMode,
  type OsmMapThemeName,
} from "@/lib/config/mapSettings";
import { isRegionCode, type RegionCode } from "@/lib/config/regions";
import { MapSettingsModel } from "@/models/MapSettings";

function isProvider(value: unknown): value is MapProviderName {
  return value === "google" || value === "osm";
}

function isCanvasStyle(value: unknown): value is MapCanvasStyle {
  return value === "roadmap" || value === "satellite" || value === "light";
}

function isOsmTheme(value: unknown): value is OsmMapThemeName {
  return (
    value === "default" ||
    value === "app" ||
    value === "midnight" ||
    value === "forest"
  );
}

function isStationAssignmentMode(
  value: unknown,
): value is StationAssignmentMode {
  return value === "shared-vehicles" || value === "zones";
}

function isZoneIdList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((zoneId) => typeof zoneId === "string" && zoneId.length > 0)
  );
}

async function requireAdmin() {
  const session = await getSession();
  return session?.role === "admin" ? session : null;
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const regionCode = request.nextUrl.searchParams.get("regionCode");
  if (!isRegionCode(regionCode)) {
    return NextResponse.json({ error: "Invalid region." }, { status: 400 });
  }
  await connectDB();
  const stored = await MapSettingsModel.findOne({ regionCode }).lean();
  const fallback = defaultMapSettings(regionCode);
  return NextResponse.json({
    data: stored
      ? {
          regionCode,
          provider: stored.provider ?? fallback.provider,
          canvasStyle: stored.canvasStyle ?? fallback.canvasStyle,
          osmTheme: stored.osmTheme ?? fallback.osmTheme,
          showStations: stored.showStations ?? fallback.showStations,
          stationAssignmentMode:
            stored.stationAssignmentMode ?? fallback.stationAssignmentMode,
          directPointZoneIds: Array.isArray(stored.directPointZoneIds)
            ? stored.directPointZoneIds
            : fallback.directPointZoneIds,
          stationZoneIds: Array.isArray(stored.stationZoneIds)
            ? stored.stationZoneIds
            : fallback.stationZoneIds,
          showZones: stored.showZones ?? fallback.showZones,
          showZoneLabels: stored.showZoneLabels ?? fallback.showZoneLabels,
          maskOutsideZones:
            stored.maskOutsideZones ?? fallback.maskOutsideZones,
        }
      : fallback,
  });
}

export async function PUT(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const regionCode = body.regionCode as RegionCode;
    if (
      !isRegionCode(regionCode) ||
      !isProvider(body.provider) ||
      !isCanvasStyle(body.canvasStyle) ||
      !isOsmTheme(body.osmTheme) ||
      !isStationAssignmentMode(body.stationAssignmentMode) ||
      !isZoneIdList(body.directPointZoneIds) ||
      !isZoneIdList(body.stationZoneIds) ||
      body.directPointZoneIds.some((zoneId: string) =>
        body.stationZoneIds.includes(zoneId),
      )
    ) {
      return NextResponse.json(
        { error: "Invalid map configuration." },
        { status: 400 },
      );
    }
    const flags = [
      "showStations",
      "showZones",
      "showZoneLabels",
      "maskOutsideZones",
    ] as const;
    if (flags.some((key) => typeof body[key] !== "boolean")) {
      return NextResponse.json(
        { error: "Map visibility settings must be boolean." },
        { status: 400 },
      );
    }
    await connectDB();
    const data = await MapSettingsModel.findOneAndUpdate(
      { regionCode },
      {
        $set: {
          regionCode,
          provider: body.provider,
          canvasStyle: body.canvasStyle,
          osmTheme: body.osmTheme,
          showStations: body.showStations,
          stationAssignmentMode: body.stationAssignmentMode,
          directPointZoneIds: body.directPointZoneIds,
          stationZoneIds: body.stationZoneIds,
          showZones: body.showZones,
          showZoneLabels: body.showZoneLabels,
          maskOutsideZones: body.maskOutsideZones,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).lean();
    const fallback = defaultMapSettings(regionCode);
    return NextResponse.json({
      data: data
        ? {
            regionCode,
            provider: data.provider ?? fallback.provider,
            canvasStyle: data.canvasStyle ?? fallback.canvasStyle,
            osmTheme: data.osmTheme ?? fallback.osmTheme,
            showStations: data.showStations ?? fallback.showStations,
            stationAssignmentMode:
              data.stationAssignmentMode ?? fallback.stationAssignmentMode,
            directPointZoneIds: Array.isArray(data.directPointZoneIds)
              ? data.directPointZoneIds
              : [],
            stationZoneIds: Array.isArray(data.stationZoneIds)
              ? data.stationZoneIds
              : [],
            showZones: data.showZones ?? fallback.showZones,
            showZoneLabels: data.showZoneLabels ?? fallback.showZoneLabels,
            maskOutsideZones:
              data.maskOutsideZones ?? fallback.maskOutsideZones,
          }
        : fallback,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to save map configuration." },
      { status: 500 },
    );
  }
}
