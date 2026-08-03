import { NextRequest, NextResponse } from "next/server";

function parseLatLng(input: string): { lat: number; lng: number } | null {
  const parts = input.split(",").map((part) => part.trim());
  if (parts.length !== 2) return null;

  const [latText, lngText] = parts;
  const lat = Number(latText);
  const lng = Number(lngText);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const directCoordinates = parseLatLng(id);
  if (directCoordinates) {
    return NextResponse.json(directCoordinates);
  }

  if (!/^[NWR]\d+$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/lookup");
  url.searchParams.set("osm_ids", id);
  url.searchParams.set("format", "jsonv2");

  const res = await fetch(url, {
    headers: { "User-Agent": "Commuter/0.1 (local development)" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    console.error("[places/details] Nominatim", res.status);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  const place = data[0];
  if (!place) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ lat: Number(place.lat), lng: Number(place.lon) });
}
