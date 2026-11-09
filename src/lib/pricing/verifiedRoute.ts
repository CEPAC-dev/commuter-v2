export type RoutePoint = { lat: number; lng: number };

export type VerifiedRouteLeg = {
  distanceKm: number;
  durationMinutes: number;
};

export type VerifiedRoute = {
  distanceKm: number;
  durationMinutes: number;
  coordinates: [number, number][];
  legs: VerifiedRouteLeg[];
};

type DirectionsResponse = {
  coordinates: [number, number][];
  distance_km: number;
  duration_minutes: number;
  legs?: VerifiedRouteLeg[];
};

export async function getVerifiedRoute(
  points: RoutePoint[],
  fetchRoute: (
    origin: string,
    destination: string,
    waypoints?: string,
  ) => Promise<DirectionsResponse[]>,
): Promise<VerifiedRoute | null> {
  if (
    points.length < 2 ||
    points.some(
      (point) =>
        !Number.isFinite(point.lat) ||
        !Number.isFinite(point.lng) ||
        point.lat < -90 ||
        point.lat > 90 ||
        point.lng < -180 ||
        point.lng > 180,
    )
  ) {
    return null;
  }

  const [origin, ...remaining] = points;
  const destination = remaining.at(-1)!;
  const waypoints = remaining
    .slice(0, -1)
    .map((point) => `${point.lat},${point.lng}`)
    .join("|");
  const routes = await fetchRoute(
    `${origin.lat},${origin.lng}`,
    `${destination.lat},${destination.lng}`,
    waypoints || undefined,
  );
  const route = routes[0];
  const legs = route?.legs;
  if (
    !route ||
    !Array.isArray(route.coordinates) ||
    route.coordinates.length < 2 ||
    !Array.isArray(legs) ||
    legs.length !== points.length - 1 ||
    legs.some(
      (leg) =>
        !Number.isFinite(leg.distanceKm) ||
        leg.distanceKm < 0 ||
        !Number.isFinite(leg.durationMinutes) ||
        leg.durationMinutes < 0,
    )
  ) {
    return null;
  }

  return {
    distanceKm: legs.reduce((total, leg) => total + leg.distanceKm, 0),
    durationMinutes: legs.reduce(
      (total, leg) => total + leg.durationMinutes,
      0,
    ),
    coordinates: route.coordinates,
    legs,
  };
}
