import type { LatLng } from "@/types/geo";

const EARTH_RADIUS_METERS = 6_371_000;

function distanceMeters(a: LatLng, b: LatLng): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(b.lat - a.lat);
  const longitudeDelta = radians(b.lng - a.lng);
  const latitudeA = radians(a.lat);
  const latitudeB = radians(b.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

function projectToSegment(point: LatLng, start: LatLng, end: LatLng) {
  const cosLatitude = Math.cos((point.lat * Math.PI) / 180);
  const startX = (start.lng - point.lng) * cosLatitude;
  const startY = start.lat - point.lat;
  const endX = (end.lng - point.lng) * cosLatitude;
  const endY = end.lat - point.lat;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const ratio =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, -(startX * deltaX + startY * deltaY) / lengthSquared),
        );
  return {
    ratio,
    point: {
      lat: start.lat + (end.lat - start.lat) * ratio,
      lng: start.lng + (end.lng - start.lng) * ratio,
    },
    distanceSquared:
      (startX + deltaX * ratio) ** 2 + (startY + deltaY * ratio) ** 2,
  };
}

function remainingRouteMeters(route: LatLng[], position: LatLng): number {
  let closestSegment = 0;
  let closestRatio = 0;
  let closestDistanceSquared = Number.POSITIVE_INFINITY;
  let closestPoint = route[0];

  for (let index = 0; index < route.length - 1; index += 1) {
    const projection = projectToSegment(
      position,
      route[index],
      route[index + 1],
    );
    if (projection.distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = projection.distanceSquared;
      closestSegment = index;
      closestRatio = projection.ratio;
      closestPoint = projection.point;
    }
  }

  let remaining = distanceMeters(closestPoint, route[closestSegment + 1]);
  for (let index = closestSegment + 1; index < route.length - 1; index += 1) {
    remaining += distanceMeters(route[index], route[index + 1]);
  }
  if (closestRatio === 0 && closestSegment === 0) {
    remaining = Math.min(
      remaining,
      distanceMeters(position, route[0]) +
        route.slice(0, -1).reduce(
          (total, point, index) =>
            total + distanceMeters(point, route[index + 1]),
          0,
        ),
    );
  }
  return remaining;
}

export function calculateTripProgress(input: {
  position: LatLng & { speed?: number | null };
  destination: LatLng;
  route?: LatLng[] | null;
}): { remainingDistanceKm: number; etaMinutes: number | null } {
  const route = input.route?.filter(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng),
  );
  const remainingMeters =
    route && route.length > 1
      ? remainingRouteMeters(route, input.position)
      : distanceMeters(input.position, input.destination);
  const speed = input.position.speed;
  const etaMinutes =
    typeof speed === "number" &&
    Number.isFinite(speed) &&
    speed >= 1 &&
    speed <= 45
      ? Math.max(1, Math.ceil(remainingMeters / speed / 60))
      : null;
  return {
    remainingDistanceKm: Math.max(0, remainingMeters / 1_000),
    etaMinutes,
  };
}
