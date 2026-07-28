const ORS_URL =
  "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

export interface ORSRoute {
  coordinates: [number, number][];
  distance_km: number;
  duration_minutes: number;
  summary: string;
}

// ── Safe sessionStorage helpers (no-ops on server) ────────────────────────
function getCached(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setCached(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* quota */
  }
}

// ── Fallback: Google Directions API via /api/directions ───────────────────
async function fetchRouteViaGoogle(
  waypoints: { lat: number; lng: number }[],
): Promise<ORSRoute[]> {
  const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
  const dest = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;

  const url = new URL(
    "/api/directions",
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000",
  );
  url.searchParams.set("origin", origin);
  url.searchParams.set("dest", dest);

  const stops = waypoints.slice(1, -1);
  if (stops.length > 0) {
    url.searchParams.set(
      "waypoints",
      stops.map((w) => `${w.lat},${w.lng}`).join("|"),
    );
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Directions request failed: ${res.status}`);

  const result = (await res.json()) as Array<{
    coordinates: [number, number][];
    distance_km: number;
    duration_minutes: number;
  }>;
  if (!result.length) throw new Error("No route found");

  return result.map((r) => ({ ...r, summary: "Fastest route" }));
}

export async function fetchRoute(
  waypoints: { lat: number; lng: number }[],
): Promise<ORSRoute[]> {
  const valid = waypoints.filter(
    (w) =>
      w &&
      typeof w.lat === "number" &&
      typeof w.lng === "number" &&
      w.lat !== 0 &&
      w.lng !== 0 &&
      w.lat >= -90 &&
      w.lat <= 90 &&
      w.lng >= -180 &&
      w.lng <= 180,
  );

  if (valid.length < 2) {
    console.warn("[Route] Not enough valid waypoints:", waypoints);
    return [];
  }

  const cacheKey = valid
    .map((w) => `${w.lat.toFixed(4)},${w.lng.toFixed(4)}`)
    .join("→");
  const cached = getCached(`ors:${cacheKey}`);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      /* corrupted */
    }
  }

  const apiKey = process.env.NEXT_PUBLIC_ORS_API_KEY;

  // ── No ORS key — fall back to Google Directions ──────────────────────────
  if (!apiKey) {
    try {
      const routes = await fetchRouteViaGoogle(valid);
      setCached(`ors:${cacheKey}`, JSON.stringify(routes));
      return routes;
    } catch (err) {
      console.error("[Route] Google fallback failed:", err);
      return [];
    }
  }

  // ── ORS path (via server proxy to avoid CORS) ─────────────────────────────
  try {
    const proxyUrl =
      typeof window !== "undefined"
        ? new URL("/api/ors", window.location.origin).toString()
        : ORS_URL;

    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: valid.map((w) => [w.lng, w.lat]) }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[ORS] HTTP ${res.status}:`, text);
      return fetchRouteViaGoogle(valid)
        .then((r) => {
          setCached(`ors:${cacheKey}`, JSON.stringify(r));
          return r;
        })
        .catch(() => []);
    }

    const data = await res.json();
    if (!data.features?.length) return [];

    const routes: ORSRoute[] = [data.features[0]].map(
      (feature: {
        geometry: { coordinates: [number, number][] };
        properties: { summary: { distance: number; duration: number } };
      }) => ({
        coordinates: (feature.geometry.coordinates as [number, number][]).map(
          ([lng, lat]) => [lat, lng] as [number, number],
        ),
        distance_km:
          Math.round((feature.properties.summary.distance / 1000) * 10) / 10,
        duration_minutes: Math.round(feature.properties.summary.duration / 60),
        summary: "Shortest route",
      }),
    );

    setCached(`ors:${cacheKey}`, JSON.stringify(routes));
    return routes;
  } catch (err) {
    console.error("[ORS] Fetch error:", err);
    // Network error (no connectivity, timeout, CORS, etc.) — fall back to Google
    try {
      const routes = await fetchRouteViaGoogle(valid);
      if (routes.length) setCached(`ors:${cacheKey}`, JSON.stringify(routes));
      return routes;
    } catch (fallbackErr) {
      console.error("[Route] Google fallback also failed:", fallbackErr);
      return [];
    }
  }
}
