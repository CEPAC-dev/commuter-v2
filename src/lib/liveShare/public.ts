import {
  detectedTripEndAt,
  isEnded,
  type ShareRideState,
  type ShareTripState,
} from "./eligibility.ts";
import {
  SHARE_END_GRACE_MS,
  SHARE_VIEW_COUNT_INTERVAL_MS,
  type PublicTripSnapshot,
  type ShareLocationState,
  projectPublicTrip,
} from "./logic.ts";
import { verifyShareToken } from "./token.ts";

export const INVALID_PUBLIC_SHARE = {
  error: "Not found",
} as const;

export interface PublicShareContext {
  share: ShareLocationState & {
    viewCount: number;
    lastViewedAt: Date | null;
  };
  trip: PublicTripSnapshot & ShareTripState;
  ride: ShareRideState | null;
}

export interface PublicShareStore {
  load(shareId: string): Promise<PublicShareContext | null>;
  markEnded(shareId: string, endedAt: Date): Promise<void>;
  touchViewer(shareId: string, now: Date, earliestLastViewedAt: Date): Promise<void>;
}

export interface PublicShareResult {
  status: 200 | 404;
  body: Record<string, unknown>;
}

export async function readPublicShare(
  input: { token: unknown; secret?: string; now?: Date },
  store: PublicShareStore,
  onFailedToken: () => Promise<unknown>,
): Promise<PublicShareResult> {
  const shareId = verifyShareToken(input.token, input.secret);
  if (!shareId) {
    await onFailedToken();
    return { status: 404, body: INVALID_PUBLIC_SHARE };
  }

  const now = input.now ?? new Date();
  const context = await store.load(shareId);
  if (
    !context ||
    !context.share.active ||
    context.share.revokedAt ||
    context.share.expiresAt.getTime() <= now.getTime()
  ) {
    await onFailedToken();
    return { status: 404, body: INVALID_PUBLIC_SHARE };
  }

  if (context.share.endedAt || isEnded(context.trip, context.ride)) {
    const endedAt =
      context.share.endedAt ??
      detectedTripEndAt(context.trip, context.ride, now);
    if (!context.share.endedAt) {
      await store.markEnded(shareId, endedAt);
    }
    if (now.getTime() - endedAt.getTime() > SHARE_END_GRACE_MS) {
      await onFailedToken();
      return { status: 404, body: INVALID_PUBLIC_SHARE };
    }
    await store.touchViewer(
      shareId,
      now,
      new Date(now.getTime() - SHARE_VIEW_COUNT_INTERVAL_MS),
    );
    return { status: 200, body: { state: "ended" } };
  }

  await store.touchViewer(
    shareId,
    now,
    new Date(now.getTime() - SHARE_VIEW_COUNT_INTERVAL_MS),
  );
  return {
    status: 200,
    body: projectPublicTrip(
      context.trip,
      context.share.lastLocation,
      now,
    ),
  };
}
