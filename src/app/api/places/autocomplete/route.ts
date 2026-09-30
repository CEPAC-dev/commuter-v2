import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json([]);

  if (req.nextUrl.searchParams.get("provider") === "google") {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return NextResponse.json([], { status: 503 });
    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text" },
      body: JSON.stringify({ input: q, languageCode: "en" }),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json([], { status: 502 });
    const data = await response.json() as { suggestions?: Array<{ placePrediction?: { placeId?: string; text?: { text?: string } } }> };
    return NextResponse.json((data.suggestions ?? []).flatMap(({ placePrediction }) => placePrediction?.placeId && placePrediction.text?.text ? [{ place_id: placePrediction.placeId, display_name: placePrediction.text.text }] : []));
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", "eg");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("accept-language", "en");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Commuter/1.0 (OpenStreetMap search)",
      Referer: process.env.APP_URL ?? "http://localhost:3000",
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) return NextResponse.json([], { status: 502 });

  const data = await res.json();
  const results = (Array.isArray(data) ? data : []).map(
    (place: { lat: string; lon: string; display_name: string }) => ({
      place_id: `${place.lat},${place.lon}`,
      display_name: place.display_name,
    }),
  );
  return NextResponse.json(results);
}
