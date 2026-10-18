import { createHmac, timingSafeEqual } from "node:crypto";

export type PickupPinConfigErrorCode =
  | "PICKUP_PIN_SECRET_MISSING"
  | "PICKUP_PIN_SECRET_TOO_SHORT"
  | "PICKUP_PIN_SECRET_INVALID_FORMAT";

export class PickupPinConfigError extends Error {
  readonly code: PickupPinConfigErrorCode;

  constructor(code: PickupPinConfigErrorCode) {
    super(code);
    this.name = "PickupPinConfigError";
    this.code = code;
  }
}

function getSecret(secret = process.env.PICKUP_PIN_SECRET): string {
  const normalized = secret?.trim();
  if (!normalized) throw new PickupPinConfigError("PICKUP_PIN_SECRET_MISSING");
  if (
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    throw new PickupPinConfigError("PICKUP_PIN_SECRET_INVALID_FORMAT");
  }
  if (normalized.length < 32) {
    throw new PickupPinConfigError("PICKUP_PIN_SECRET_TOO_SHORT");
  }
  return normalized;
}

export function assertPickupPinSecret(secret?: string): string {
  return getSecret(secret);
}

export function derivePin(
  tripId: string,
  rideId: string,
  version: number,
  secret?: string,
): string {
  if (!tripId || !rideId || !Number.isSafeInteger(version) || version < 0) {
    throw new TypeError("Invalid trip, ride, or PIN version.");
  }

  const digest = createHmac("sha256", getSecret(secret))
    .update(`${tripId}:${rideId}:${version}`)
    .digest();
  // Mapping a 32-bit HMAC value modulo 10,000 has a negligible modulo bias.
  const value = digest.readUInt32BE(0) % 10_000;
  return String(value).padStart(4, "0");
}

export function verifyPin(
  input: unknown,
  tripId: string,
  rideId: string,
  version: number,
  secret?: string,
): boolean {
  if (typeof input !== "string" || !/^\d{4}$/.test(input)) return false;

  const expected = Buffer.from(derivePin(tripId, rideId, version, secret));
  const actual = Buffer.from(input);
  return timingSafeEqual(actual, expected);
}
