import { NextRequest, NextResponse } from "next/server";

export interface DirectionsResult {
  coordinates: [number, number][];
  distance_km: number;
  duration_minutes: number;
}

/** Fetch driving directions from OSRM without exposing provider credentials. */
export async function fetchDirections(
  origin: string,
  dest: string,
  waypoints?: string,
): Promise<DirectionsResult[]> {
  const coordinates = [origin, ...(waypoints?.split("|") ?? []), dest]
    .map((point) => point.split(",").map(Number))
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
    .map(([lat, lng]) => `${lng},${lat}`);
  if (coordinates.length < 2) return [];

  const url = new URL(
    `https://router.project-osrm.org/route/v1/driving/${coordinates.join(";")}`,
  );
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    routes?: Array<{
      distance: number;
      duration: number;
      geometry: { coordinates: [number, number][] };
    }>;
  };
  const route = data.routes?.[0];
  if (!route) return [];

  return [
    {
      coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distance_km: Math.round((route.distance / 1000) * 10) / 10,
      duration_minutes: Math.round(route.duration / 60),
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

