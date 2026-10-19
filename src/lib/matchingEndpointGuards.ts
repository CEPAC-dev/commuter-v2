import { createHash, timingSafeEqual } from "node:crypto";

const CRON_SECRET_MIN_LENGTH = 32;

export function buildEligibleMatchTripFilter(): Record<string, unknown> {
  return {
    status: "submitted",
    paymentStatus: "paid",
    rideId: null,
  };
}

export class TripClaimConflictError extends Error {
  readonly skippedCount: number;

  constructor(skippedCount: number) {
    super("One or more Trips are no longer eligible for matching.");
    this.name = "TripClaimConflictError";
    this.skippedCount = skippedCount;
  }
}

export function isValidCronSecret(
  configuredSecret: string | undefined,
  providedSecret: string | undefined,
): boolean {
  const expected = configuredSecret?.trim();
  const provided = providedSecret?.trim();
  if (
    !expected ||
    !provided ||
    expected.length < CRON_SECRET_MIN_LENGTH ||
    provided.length < CRON_SECRET_MIN_LENGTH
  ) {
    return false;
  }

  const expectedDigest = createHash("sha256").update(expected).digest();
  const providedDigest = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedDigest, providedDigest);
}

export function isMatchingEndpointAuthorized(input: {
  isAdmin: boolean;
  configuredCronSecret?: string;
  providedCronSecret?: string;
}): boolean {
  return (
    input.isAdmin ||
    isValidCronSecret(input.configuredCronSecret, input.providedCronSecret)
  );
}

export function isTripClaimTransactionConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? error.code : undefined;
  const errorLabels = "errorLabels" in error ? error.errorLabels : undefined;
  return (
    code === 112 ||
    (Array.isArray(errorLabels) &&
      errorLabels.includes("TransientTransactionError"))
  );
}

export type TripClaimResult =
  | { ok: true; claimedTripIds: string[] }
  | { ok: false; reason: "TRIP_CLAIM_CONFLICT"; skippedCount: number };

export function evaluateTripClaim(
  expectedTripIds: readonly string[],
  claimedTripIds: readonly string[],
): TripClaimResult {
  const expected = new Set(expectedTripIds);
  const claimed = new Set(claimedTripIds);
  const allExpectedClaimed =
    expected.size === expectedTripIds.length &&
    claimed.size === claimedTripIds.length &&
    claimed.size === expected.size &&
    [...expected].every((tripId) => claimed.has(tripId));

  if (!allExpectedClaimed) {
    return {
      ok: false,
      reason: "TRIP_CLAIM_CONFLICT",
      skippedCount: Math.max(0, expected.size - claimed.size),
    };
  }

  return { ok: true, claimedTripIds: [...claimed] };
}
