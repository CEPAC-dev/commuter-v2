import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng)
    return NextResponse.json({ error: "missing lat/lng" }, { status: 400 });

  if (req.nextUrl.searchParams.get("provider") === "google") {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return NextResponse.json({ error: "Google Maps is not configured" }, { status: 503 });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&key=${encodeURIComponent(key)}`, { cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });
    const data = await response.json() as { results?: Array<{ formatted_address?: string }> };
    return NextResponse.json({ address: data.results?.[0]?.formatted_address ?? `${lat}, ${lng}` });
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lng);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("accept-language", "en");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Commuter/1.0 (OpenStreetMap reverse geocode)",
      Referer: process.env.APP_URL ?? "http://localhost:3000",
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });

  const data = (await res.json()) as { display_name?: string };
  const address = data.display_name ?? `${lat}, ${lng}`;
  return NextResponse.json({ address });
}
