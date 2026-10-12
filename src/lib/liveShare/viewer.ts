export const LIVE_VIEWER_POLL_INTERVAL_MS = 10_000;
export const LIVE_VIEWER_RETRY_MAX_MS = 60_000;
export const LIVE_VIEWER_STALE_AFTER_SECONDS = 45;

export function isUnavailableLiveViewerStatus(status: number): boolean {
  return status === 404;
}

export type LiveViewerState =
  | "loading"
  | "waiting"
  | "live"
  | "stale"
  | "ended"
  | "unavailable"
  | "connection";

export interface PublicLiveShare {
  state: "waiting" | "live" | "stale" | "ended";
  tripStatus?: string;
  pickup?: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number };
  location?: {
    lat: number;
    lng: number;
    accuracy: number | null;
    heading: number | null;
    recordedAt: string;
    ageSeconds: number;
  } | null;
  driver?: {
    firstName: string | null;
    vehicle: {
      make: string | null;
      model: string | null;
      color: string | null;
      plate: string | null;
    };
  };
  serverTime: string;
}

export function deriveLiveViewerState(
  data: PublicLiveShare | null,
  elapsedSinceServerMs = 0,
  options: { loading?: boolean; unavailable?: boolean; connection?: boolean } = {},
): LiveViewerState {
  if (options.unavailable) return "unavailable";
  if (options.connection) return "connection";
  if (options.loading || !data) return "loading";
  if (data.state === "ended") return "ended";
  if (data.state === "waiting" || !data.location) return "waiting";

  const serverAgeMs =
    Math.max(0, data.location.ageSeconds) * 1_000 +
    Math.max(0, elapsedSinceServerMs);
  return data.state === "stale" ||
    serverAgeMs >= LIVE_VIEWER_STALE_AFTER_SECONDS * 1_000
    ? "stale"
    : "live";
}

export function getLiveViewerPollDelayMs(input: {
  failureCount: number;
  nextAfterMs?: number | null;
  retryAfterMs?: number | null;
  paused?: boolean;
  terminal?: boolean;
}): number | null {
  if (input.paused || input.terminal) return null;
  const failures = Number.isFinite(input.failureCount)
    ? Math.max(0, Math.floor(input.failureCount))
    : 0;
  const baseDelay =
    failures === 0
      ? LIVE_VIEWER_POLL_INTERVAL_MS
      : Math.min(
          LIVE_VIEWER_POLL_INTERVAL_MS * 2 ** Math.min(failures, 30),
          LIVE_VIEWER_RETRY_MAX_MS,
        );
  return Math.min(
    LIVE_VIEWER_RETRY_MAX_MS,
    Math.max(
      baseDelay,
      Number.isFinite(input.nextAfterMs) ? Math.max(0, input.nextAfterMs ?? 0) : 0,
      Number.isFinite(input.retryAfterMs) ? Math.max(0, input.retryAfterMs ?? 0) : 0,
    ),
  );
}

export function retryAfterHeaderMs(
  value: string | null,
  nowMs = Date.now(),
): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - nowMs) : null;
}

export function isPublicLiveShare(value: unknown): value is PublicLiveShare {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PublicLiveShare>;
  if (
    !["waiting", "live", "stale", "ended"].includes(candidate.state ?? "") ||
    typeof candidate.serverTime !== "string"
  ) {
    return false;
  }
  if (candidate.state === "ended") return true;
  const validPoint = (point: unknown) => {
    if (!point || typeof point !== "object") return false;
    const record = point as { lat?: unknown; lng?: unknown };
    return (
      typeof record.lat === "number" &&
      Number.isFinite(record.lat) &&
      typeof record.lng === "number" &&
      Number.isFinite(record.lng)
    );
  };
  if (!validPoint(candidate.pickup) || !validPoint(candidate.dropoff)) {
    return false;
  }
  if (candidate.state === "waiting") {
    return candidate.location === null;
  }
  return (
    validPoint(candidate.location) &&
    typeof candidate.location?.ageSeconds === "number" &&
    Number.isFinite(candidate.location.ageSeconds)
  );
}

export function parsePublicLiveShare(value: unknown): PublicLiveShare | null {
  if (!isPublicLiveShare(value)) return null;
  if (value.state === "ended") {
    return { state: "ended", serverTime: value.serverTime };
  }
  if (!value.pickup || !value.dropoff) return null;
  const safeString = (entry: unknown): string | null =>
    typeof entry === "string" ? entry : null;
  const sourceDriver =
    value.driver && typeof value.driver === "object" ? value.driver : null;
  const sourceVehicle =
    sourceDriver?.vehicle && typeof sourceDriver.vehicle === "object"
      ? sourceDriver.vehicle
      : null;
  const publicData: PublicLiveShare = {
    state: value.state,
    pickup: { lat: value.pickup.lat, lng: value.pickup.lng },
    dropoff: { lat: value.dropoff.lat, lng: value.dropoff.lng },
    location: value.location
      ? {
          lat: value.location.lat,
          lng: value.location.lng,
          accuracy: value.location.accuracy,
          heading: value.location.heading,
          recordedAt: value.location.recordedAt,
          ageSeconds: value.location.ageSeconds,
        }
      : null,
    driver: value.driver
      ? {
          firstName: safeString(sourceDriver?.firstName),
          vehicle: {
            make: safeString(sourceVehicle?.make),
            model: safeString(sourceVehicle?.model),
            color: safeString(sourceVehicle?.color),
            plate: safeString(sourceVehicle?.plate),
          },
        }
      : undefined,
    serverTime: value.serverTime,
  };
  if (typeof value.tripStatus === "string") {
    publicData.tripStatus = value.tripStatus;
  }
  return publicData;
}
