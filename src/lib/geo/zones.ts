type Position = [number, number];
type Ring = Position[];
type PolygonCoordinates = Ring[];
type MultiPolygonCoordinates = PolygonCoordinates[];

export interface ZoneFeature {
  type: "Feature";
  id?: string | number;
  properties?: { NAME?: string };
  geometry?:
    | { type: "Polygon"; coordinates: PolygonCoordinates }
    | { type: "MultiPolygon"; coordinates: MultiPolygonCoordinates };
}

function pointInRing(point: Position, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[j];
    const intersects =
      y1 > point[1] !== y2 > point[1] &&
      point[0] < ((x2 - x1) * (point[1] - y1)) / (y2 - y1) + x1;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: Position, polygon: PolygonCoordinates) {
  const outerRing = polygon[0];
  if (!outerRing?.length || !pointInRing(point, outerRing)) return false;
  return !polygon.slice(1).some((hole) => pointInRing(point, hole));
}

export function isPointInZone(point: [number, number], feature?: ZoneFeature) {
  if (!feature?.geometry) return false;
  const { geometry } = feature;
  if (geometry.type === "Polygon") {
    return pointInPolygon(point, geometry.coordinates);
  }
  return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
}

export function isPointInAnyZone(point: Position, features: ZoneFeature[]) {
  return features.some((feature) => isPointInZone(point, feature));
}

export function findZoneAtPoint(point: Position, features: ZoneFeature[]) {
  return features.find((feature) => isPointInZone(point, feature));
}

export function getZoneName(feature?: ZoneFeature) {
  return feature?.properties?.NAME?.trim() || String(feature?.id ?? "");
}
