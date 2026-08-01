import { NextRequest, NextResponse } from "next/server";

const KEY = process.env.ORS_API_KEY ?? process.env.NEXT_PUBLIC_ORS_API_KEY!;

export interface DirectionsResult {
  coordinates: [number, number][];
  distance_km: number;
  duration_minutes: number;
}

/** Fetch driving directions directly from Google (no internal HTTP hop). */
export async function fetchDirections(
  origin: string,
  dest: string,
  waypoints?: string,
): Promise<DirectionsResult[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", dest);
  url.searchParams.set("key", KEY);
  url.searchParams.set("mode", "driving");
  if (waypoints) url.searchParams.set("waypoints", waypoints);

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = await res.json();
  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("[api/directions]", data.status, data.error_message);
  }
  const leg = data.routes?.[0]?.legs?.[0];
  if (!leg) return [];

  const legs: { distance: { value: number }; duration: { value: number } }[] =
    data.routes[0].legs;
  const totalDistanceM = legs.reduce((sum, l) => sum + l.distance.value, 0);
  const totalDurationS = legs.reduce((sum, l) => sum + l.duration.value, 0);

  const encoded: string = data.routes[0].overview_polyline.points;
  const coords = decodePolyline(encoded);

  return [
    {
      coordinates: coords,
      distance_km: Math.round((totalDistanceM / 1000) * 10) / 10,
      duration_minutes: Math.round(totalDurationS / 60),
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

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let i = 0,
    lat = 0,
    lng = 0;
  while (i < encoded.length) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}
