import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng)
    return NextResponse.json({ error: "missing lat/lng" }, { status: 400 });

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
