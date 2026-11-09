import type { LatLng } from "@/types/geo";

export interface DriverLocationUpdate {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  recordedAt: string;
  receivedAt: string;
  ageSeconds?: number;
  stale?: boolean;
}

export function parseDriverLocationUpdate(
  value: unknown,
): DriverLocationUpdate | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<DriverLocationUpdate>;
  if (
    typeof data.lat !== "number" ||
    !Number.isFinite(data.lat) ||
    data.lat < -90 ||
    data.lat > 90 ||
    typeof data.lng !== "number" ||
    !Number.isFinite(data.lng) ||
    data.lng < -180 ||
    data.lng > 180 ||
    typeof data.recordedAt !== "string" ||
    !Number.isFinite(Date.parse(data.recordedAt)) ||
    typeof data.receivedAt !== "string" ||
    !Number.isFinite(Date.parse(data.receivedAt))
  ) {
    return null;
  }
  const nullableNumber = (entry: unknown): entry is number | null =>
    entry === null || (typeof entry === "number" && Number.isFinite(entry));
  if (
    !nullableNumber(data.accuracy) ||
    !nullableNumber(data.heading) ||
    !nullableNumber(data.speed)
  ) {
    return null;
  }
  return {
    lat: data.lat,
    lng: data.lng,
    accuracy: data.accuracy,
    heading: data.heading,
    speed: data.speed,
    recordedAt: data.recordedAt,
    receivedAt: data.receivedAt,
    ...(typeof data.ageSeconds === "number" && Number.isFinite(data.ageSeconds)
      ? { ageSeconds: Math.max(0, data.ageSeconds) }
      : {}),
    ...(typeof data.stale === "boolean" ? { stale: data.stale } : {}),
  };
}

export function toMapPoint(location: DriverLocationUpdate): LatLng {
  return { lat: location.lat, lng: location.lng };
}
