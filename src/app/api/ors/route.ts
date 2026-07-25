import { NextRequest, NextResponse } from "next/server";

const ORS_URL =
  "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ORS_API_KEY ?? process.env.NEXT_PUBLIC_ORS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ORS API key not configured" }, { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Try a couple of times for transient upstream failures (504, 502)
  const attempts = 2;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(ORS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const text = await res.text();
      const contentType = res.headers.get("content-type") || "";

      if (!res.ok) {
        console.error(`/api/ors error (attempt ${i + 1})`, res.status, text.slice(0, 200));
        // Retry on server errors
        if (res.status >= 500 && i + 1 < attempts) {
          await new Promise(r => setTimeout(r, 500 * (i + 1)));
          continue;
        }
        return NextResponse.json({ error: "ORS request failed", details: text }, { status: 502 });
      }

      // Return raw ORS response with correct content-type
      if (contentType.includes("json") || contentType.includes("geo+json")) {
        try {
          return NextResponse.json(JSON.parse(text));
        } catch {
          return new NextResponse(text, { status: 200, headers: { "Content-Type": contentType } });
        }
      }

      return new NextResponse(text, { status: 200, headers: { "Content-Type": contentType } });
    } catch (err) {
      clearTimeout(timeout);
      console.error(`/api/ors fetch attempt ${i + 1} failed:`, err);
      if (i + 1 < attempts) {
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
        continue;
      }
      return NextResponse.json({ error: "Network error contacting ORS" }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "ORS request failed after retries" }, { status: 502 });
}
