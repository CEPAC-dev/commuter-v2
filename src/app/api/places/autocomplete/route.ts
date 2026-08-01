import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json([]);

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${q}, Egypt`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "eg");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "Commuter/0.1 (local development)",
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    console.error("[places/autocomplete] Nominatim", res.status);
    return NextResponse.json([], { status: 502 });
  }

  const data = (await res.json()) as Array<{
    osm_type: "node" | "way" | "relation";
    osm_id: number;
    display_name: string;
  }>;
  const results = data.map((place) => ({
    place_id: `${place.osm_type[0].toUpperCase()}${place.osm_id}`,
    display_name: place.display_name,
  }));
  return NextResponse.json(results);
}
