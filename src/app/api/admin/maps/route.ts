import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import {
  defaultMapSettings,
  type MapCanvasStyle,
  type MapProviderName,
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
  return NextResponse.json({ data: stored ?? defaultMapSettings(regionCode) });
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
      !isOsmTheme(body.osmTheme)
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
          showZones: body.showZones,
          showZoneLabels: body.showZoneLabels,
          maskOutsideZones: body.maskOutsideZones,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).lean();
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: "Unable to save map configuration." },
      { status: 500 },
    );
  }
}
