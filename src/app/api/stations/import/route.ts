import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

// Admin — upload a GeoJSON/JSON file matching the PT910 station-points
// structure ({type:"FeatureCollection", features:[{id, geometry:{type:"Point",
// coordinates:[lng,lat]}, properties:{OBJECTID,name,direction,landmark,station_type}}]}).
// Fully REPLACES the station points collection with the uploaded data.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    {
      error:
        "Direct station import is disabled. Upload and validate a station dataset before publishing.",
    },
    { status: 410 },
  );
}
