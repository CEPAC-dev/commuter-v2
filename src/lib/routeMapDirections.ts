export interface RouteMapPoint {
  lat: number;
  lng: number;
}

interface LoadRouteCoordinatesOptions {
  pickup?: RouteMapPoint | null;
  dropoff?: RouteMapPoint | null;
  stops?: RouteMapPoint[];
  stations?: RouteMapPoint[];
  routeCoordinates?: RouteMapPoint[];
  fetcher?: typeof fetch;
}

function isValidPoint(point?: RouteMapPoint | null): point is RouteMapPoint {
  return (
    !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
  );
}

export async function loadRouteCoordinates({
  pickup,
  dropoff,
  stops = [],
  stations = [],
  routeCoordinates,
  fetcher = fetch,
}: LoadRouteCoordinatesOptions): Promise<RouteMapPoint[] | null> {
  if (routeCoordinates && routeCoordinates.length > 1) {
    return routeCoordinates;
  }
  if (!isValidPoint(pickup) || !isValidPoint(dropoff)) return null;

  const query = new URLSearchParams({
    origin: `${pickup.lat},${pickup.lng}`,
    dest: `${dropoff.lat},${dropoff.lng}`,
  });
  const waypoints = [...stops, ...stations]
    .filter(isValidPoint)
    .map((point) => `${point.lat},${point.lng}`);
  if (waypoints.length) query.set("waypoints", waypoints.join("|"));

  const response = await fetcher(`/api/directions?${query.toString()}`);
  if (!response.ok) return null;

  const data: unknown = await response.json();
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== "object") {
    return null;
  }
  const coordinates = (data[0] as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates)) return null;

  const route = coordinates.flatMap((coordinate): RouteMapPoint[] => {
    if (
      !Array.isArray(coordinate) ||
      typeof coordinate[0] !== "number" ||
      !Number.isFinite(coordinate[0]) ||
      typeof coordinate[1] !== "number" ||
      !Number.isFinite(coordinate[1])
    ) {
      return [];
    }
    return [{ lat: coordinate[0], lng: coordinate[1] }];
  });
  return route.length > 1 ? route : null;
}
