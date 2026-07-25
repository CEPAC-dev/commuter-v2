import { NextRequest, NextResponse } from "next/server";

const ORS_URL =
  "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ORS_API_KEY ?? process.env.NEXT_PUBLIC_ORS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ORS API key not configured" },
      { status: 500 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const res = await fetch(ORS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      console.error("/api/ors error", res.status, text);
      return NextResponse.json(
        { error: "ORS request failed", details: text },
        { status: 502 },
      );
    }

    // Return raw ORS response with correct content-type
    if (
      contentType.includes("application/json") ||
      contentType.includes("application/geo+json") ||
      contentType.includes("json")
    ) {
      try {
        return NextResponse.json(JSON.parse(text));
      } catch {
        return new NextResponse(text, {
          status: 200,
          headers: { "Content-Type": contentType },
        });
      }
    }

    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  } catch (err) {
    console.error("/api/ors fetch error:", err);
    return NextResponse.json(
      { error: "Network error contacting ORS" },
      { status: 502 },
    );
  }
}
