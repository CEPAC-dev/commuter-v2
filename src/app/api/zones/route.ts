import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  RegionAccessError,
  resolveActiveRegion,
} from "@/lib/regions/resolveActiveRegion";
import { getServiceZoneConfig } from "@/lib/geo/zones.server";
import { getMapSettings } from "@/lib/maps/settings";
import { STATION_TYPE_RULES } from "@/lib/geo/stations";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const region = await resolveActiveRegion({
      userId: session.userId,
      requested: request.nextUrl.searchParams.get("region"),
    });
    const [serviceZones, mapSettings] = await Promise.all([
      getServiceZoneConfig(region.code),
      getMapSettings(region.code),
    ]);

    return NextResponse.json(
      {
        ...serviceZones,
        stationAssignment: {
          mode: mapSettings.stationAssignmentMode,
          directPointZoneIds: mapSettings.directPointZoneIds,
          stationZoneIds: mapSettings.stationZoneIds,
          showZones: mapSettings.showZones,
          stationTypeRules: STATION_TYPE_RULES,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load service zones.",
      },
      {
        status: error instanceof RegionAccessError ? error.status : 500,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
