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
  url.searchParams.set("zoom", "18");

  const res = await fetch(url, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "Commuter/0.1 (local development)",
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    console.error("[geocode/reverse] Nominatim", res.status);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  const data = (await res.json()) as { display_name?: string };
  const address = data.display_name ?? `${lat}, ${lng}`;
  return NextResponse.json({ address });
}
