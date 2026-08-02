// Routing powered by the internal OSM directions proxy (via /api/directions)

export interface Waypoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface OSRMRoute {
  coordinates:      [number, number][]; // [lat, lng] pairs
  distance_km:      number;
  duration_minutes: number;
}

function cacheKey(waypoints: Waypoint[]): string {
  return `directions:${waypoints.map((w) => `${w.lat.toFixed(4)},${w.lng.toFixed(4)}`).join('→')}`;
}

export async function fetchRoadRoute(waypoints: Waypoint[]): Promise<OSRMRoute> {
  const routes = await fetchRoadRoutes(waypoints);
  return routes[0];
}

export async function fetchRoadRoutes(waypoints: Waypoint[]): Promise<OSRMRoute[]> {
  if (waypoints.length < 2) throw new Error('Need at least 2 waypoints');

  const key = cacheKey(waypoints);
  if (typeof sessionStorage !== 'undefined') {
    const cached = sessionStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  }

  const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
  const dest   = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;

  const url = new URL('/api/directions', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  url.searchParams.set('origin', origin);
  url.searchParams.set('dest', dest);

  // Middle stops (everything except first and last)
  const stops = waypoints.slice(1, -1);
  if (stops.length > 0) {
    url.searchParams.set('waypoints', stops.map((w) => `${w.lat},${w.lng}`).join('|'));
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Directions request failed: ${res.status}`);

  const result: OSRMRoute[] = await res.json();
  if (!result.length) throw new Error('No route found');

  if (typeof sessionStorage !== 'undefined') {
    try { sessionStorage.setItem(key, JSON.stringify(result)); } catch { /* quota */ }
  }

  return result;
}

