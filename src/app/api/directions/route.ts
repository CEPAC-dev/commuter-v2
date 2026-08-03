import { NextRequest, NextResponse } from "next/server";

export interface DirectionsResult {
  coordinates: [number, number][];
  distance_km: number;
  duration_minutes: number;
}

/** Fetch driving directions from OSRM without exposing provider credentials. */
/** Fetch driving directions from OSRM in the given waypoint order. */
export async function fetchDirections(
  origin: string,
  dest: string,
  waypoints?: string,
): Promise<DirectionsResult[]> {
  const coordinates = [origin, ...(waypoints ? waypoints.split("|") : []), dest]
    .map((point) => point.trim())
    .filter(Boolean)
    .map((point) => {
      const [lat, lng] = point.split(",").map((value) => Number(value.trim()));
      return { lat, lng };
    })
    .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng))
    .map(({ lat, lng }) => `${lng},${lat}`);

  if (coordinates.length < 2) {
    return [];
  }

  const url = new URL(
    `https://router.project-osrm.org/route/v1/driving/${coordinates.join(";")}`,
  );
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    code?: string;
    message?: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry?: { coordinates: [number, number][] };
    }>;
  };

  if (data.code && data.code !== "Ok") {
    console.error("[api/directions]", data.code, data.message);
  }

  const route = data.routes?.[0];
  if (!route) return [];

  const coords = (route.geometry?.coordinates ?? []).map(
    ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
  );

  return [
    {
      coordinates: coords,
      distance_km: Math.round(((route.distance ?? 0) / 1000) * 10) / 10,
      duration_minutes: Math.round((route.duration ?? 0) / 60),
    },
  ];
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin");
  const dest = req.nextUrl.searchParams.get("dest");
  if (!origin || !dest)
    return NextResponse.json({ error: "missing origin/dest" }, { status: 400 });

  const wps = req.nextUrl.searchParams.get("waypoints");
  const result = await fetchDirections(origin, dest, wps ?? undefined);
  return NextResponse.json(result);
}
