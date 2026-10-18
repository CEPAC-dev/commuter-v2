import {
  canShare,
  detectedTripEndAt,
  isEnded,
  type ShareRideState,
  type ShareTripState,
} from "./eligibility.ts";

export const SHARE_LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const SHARE_END_GRACE_MS = 30 * 60 * 1000;
export const SHARE_MIN_UPDATE_INTERVAL_MS = 3 * 1000;
export const SHARE_LOCATION_STALE_MS = 45 * 1000;
export const SHARE_VIEW_COUNT_INTERVAL_MS = 60 * 1000;
export const SHARE_CREATION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_SHARE_CREATIONS_PER_TRIP_PER_WINDOW = 5;
export const MAX_LOCATION_ACCURACY_METERS = 1_000;
export const MAX_RECORDED_LOCATION_AGE_MS = 2 * 60 * 1000;
export const MAX_RECORDED_LOCATION_FUTURE_MS = 30 * 1000;

export interface LocationInput {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  recordedAt: Date;
}

export type LocationValidation =
  | { valid: true; value: LocationInput }
  | { valid: false; reason: string; errorCode?: string };

function nullableFiniteNumber(value: unknown): value is number | null | undefined {
  return value === null || value === undefined || (typeof value === "number" && Number.isFinite(value));
}

export function validateLocationInput(
  input: unknown,
  now = new Date(),
): LocationValidation {
  if (!input || typeof input !== "object") {
    return { valid: false, reason: "Invalid location body." };
  }
  const body = input as Record<string, unknown>;
  if (
    typeof body.lat !== "number" ||
    !Number.isFinite(body.lat) ||
    body.lat < -90 ||
    body.lat > 90 ||
    typeof body.lng !== "number" ||
    !Number.isFinite(body.lng) ||
    body.lng < -180 ||
    body.lng > 180 ||
    !nullableFiniteNumber(body.accuracy) ||
    !nullableFiniteNumber(body.heading) ||
    !nullableFiniteNumber(body.speed)
  ) {
    return { valid: false, reason: "Invalid location coordinates or measurements." };
  }

  const accuracy = body.accuracy ?? null;
  const heading = body.heading ?? null;
  const speed = body.speed ?? null;
  if (accuracy !== null && accuracy > MAX_LOCATION_ACCURACY_METERS) {
    return {
      valid: false,
      reason: "Location accuracy is too low. Move to an open area and try again.",
      errorCode: "LOCATION_ACCURACY_TOO_LOW",
    };
  }
  if (
    (accuracy !== null && accuracy < 0) ||
    (heading !== null && (heading < 0 || heading > 360)) ||
    (speed !== null && speed < 0)
  ) {
    return { valid: false, reason: "Invalid location measurements." };
  }

  const recordedAt =
    body.recordedAt instanceof Date
      ? body.recordedAt
      : typeof body.recordedAt === "string" ||
          typeof body.recordedAt === "number"
        ? new Date(body.recordedAt)
        : new Date(Number.NaN);
  const timestamp = recordedAt.getTime();
  if (
    !Number.isFinite(timestamp) ||
    timestamp < now.getTime() - MAX_RECORDED_LOCATION_AGE_MS ||
    timestamp > now.getTime() + MAX_RECORDED_LOCATION_FUTURE_MS
  ) {
    return { valid: false, reason: "Location timestamp is outside the allowed range." };
  }

  return {
    valid: true,
    value: {
      lat: body.lat,
      lng: body.lng,
      accuracy,
      heading,
      speed,
      recordedAt,
    },
  };
}

export interface ShareLocationState {
  id: string;
  active: boolean;
  revokedAt: Date | null;
  endedAt: Date | null;
  expiresAt: Date;
  lastLocation?: (LocationInput & { receivedAt: Date }) | null;
}

export interface LocationUpdateContext {
  share: ShareLocationState;
  trip: ShareTripState;
  ride: ShareRideState | null;
}

export interface LocationUpdateStore {
  load(shareId: string): Promise<LocationUpdateContext | null>;
  markEnded(shareId: string, endedAt: Date): Promise<void>;
  updateLocationIfDue(input: {
    shareId: string;
    now: Date;
    earliestReceivedAt: Date;
    location: LocationInput;
  }): Promise<boolean>;
}

export type LocationUpdateResult =
  | { kind: "updated"; ok: true; nextAfterMs: number }
  | { kind: "too_soon"; ok: false; nextAfterMs: number }
  | { kind: "ended" | "ineligible" | "not_found"; ok: false };

export interface RevokeShareStore {
  revokeAndClear(shareId: string, revokedAt: Date): Promise<boolean>;
}

export async function revokeShareLocation(
  shareId: string,
  revokedAt: Date,
  store: RevokeShareStore,
): Promise<boolean> {
  return store.revokeAndClear(shareId, revokedAt);
}

function isShareUsable(share: ShareLocationState, now: Date): boolean {
  return (
    share.active &&
    !share.revokedAt &&
    share.expiresAt.getTime() > now.getTime()
  );
}

export async function updateShareLocation(
  input: {
    shareId: string;
    ownerId: string;
    location: LocationInput;
    now?: Date;
  },
  store: LocationUpdateStore,
): Promise<LocationUpdateResult> {
  const now = input.now ?? new Date();
  const context = await store.load(input.shareId);
  if (!context || !isShareUsable(context.share, now)) {
    return { kind: "not_found", ok: false };
  }
  if (context.share.endedAt || isEnded(context.trip, context.ride)) {
    await store.markEnded(
      input.shareId,
      context.share.endedAt ??
        detectedTripEndAt(context.trip, context.ride, now),
    );
    return { kind: "ended", ok: false };
  }
  if (!canShare(context.trip, input.ownerId, context.ride)) {
    return { kind: "ineligible", ok: false };
  }

  const earliestReceivedAt = new Date(
    now.getTime() - SHARE_MIN_UPDATE_INTERVAL_MS,
  );
  const updated = await store.updateLocationIfDue({
    shareId: input.shareId,
    now,
    earliestReceivedAt,
    location: input.location,
  });
  if (updated) {
    return {
      kind: "updated",
      ok: true,
      nextAfterMs: SHARE_MIN_UPDATE_INTERVAL_MS,
    };
  }

  const current = await store.load(input.shareId);
  if (!current || !isShareUsable(current.share, now)) {
    return { kind: "not_found", ok: false };
  }
  if (current.share.endedAt || isEnded(current.trip, current.ride)) {
    await store.markEnded(
      input.shareId,
      current.share.endedAt ??
        detectedTripEndAt(current.trip, current.ride, now),
    );
    return { kind: "ended", ok: false };
  }
  const lastReceivedAt = current.share.lastLocation?.receivedAt?.getTime();
  if (lastReceivedAt !== undefined) {
    const nextAfterMs = Math.max(
      0,
      lastReceivedAt + SHARE_MIN_UPDATE_INTERVAL_MS - now.getTime(),
    );
    if (nextAfterMs > 0) {
      return { kind: "too_soon", ok: false, nextAfterMs };
    }
  }
  return { kind: "not_found", ok: false };
}

export interface PublicTripSnapshot {
  status: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  assignedDriver?: {
    name?: string | null;
    carBrand?: string | null;
    carModel?: string | null;
    vehicleColor?: string | null;
    plateChar1?: string | null;
    plateChar2?: string | null;
    plateChar3?: string | null;
    plateDigits?: string | null;
  } | null;
}

export interface PublicLocation {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  recordedAt: string;
  ageSeconds: number;
}

export function projectPublicTrip(
  trip: PublicTripSnapshot,
  location: ShareLocationState["lastLocation"],
  now = new Date(),
) {
  const receivedAt = location?.receivedAt?.getTime();
  const ageMs =
    receivedAt === undefined ? null : Math.max(0, now.getTime() - receivedAt);
  const ageSeconds = ageMs === null ? null : Math.floor(ageMs / 1000);
  const stale = ageMs !== null && ageMs >= SHARE_LOCATION_STALE_MS;
  const snapshot = trip.assignedDriver;
  const plate =
    snapshot &&
    [snapshot.plateChar1, snapshot.plateChar2, snapshot.plateChar3, snapshot.plateDigits]
      .every((part) => typeof part === "string" && part.trim())
      ? [snapshot.plateChar1, snapshot.plateChar2, snapshot.plateChar3, snapshot.plateDigits]
          .join(" ")
      : null;

  const publicLocation: PublicLocation | null = location
    ? {
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        heading: location.heading,
        recordedAt: location.recordedAt.toISOString(),
        ageSeconds: ageSeconds ?? 0,
      }
    : null;

  return {
    state: !location ? "waiting" : stale ? "stale" : "live",
    tripStatus: trip.status,
    pickup: {
      lat: trip.pickup.lat,
      lng: trip.pickup.lng,
    },
    dropoff: {
      lat: trip.dropoff.lat,
      lng: trip.dropoff.lng,
    },
    location: publicLocation,
    driver: {
      firstName: snapshot?.name?.trim().split(/\s+/)[0] ?? null,
      vehicle: {
        make: snapshot?.carBrand ?? null,
        model: snapshot?.carModel ?? null,
        color: snapshot?.vehicleColor ?? null,
        plate,
      },
    },
    serverTime: now.toISOString(),
  };
}
