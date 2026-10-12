import { createHmac, timingSafeEqual } from "node:crypto";

const SHARE_ID_PATTERN = /^[a-f\d]{24}$/i;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_PATTERN = /^([a-f\d]{24})\.([A-Za-z0-9_-]{43})$/i;

function getSecret(secret = process.env.LIVE_SHARE_SECRET): string {
  if (!secret?.trim()) {
    throw new Error(
      "LIVE_SHARE_SECRET is not configured. Set LIVE_SHARE_SECRET before using live sharing.",
    );
  }
  return secret;
}

export function assertLiveShareSecret(secret?: string): string {
  return getSecret(secret);
}

function signatureFor(shareId: string, secret?: string): Buffer {
  return createHmac("sha256", getSecret(secret))
    .update(shareId)
    .digest();
}

export function createShareToken(shareId: string, secret?: string): string {
  if (!SHARE_ID_PATTERN.test(shareId)) {
    throw new Error("Cannot create a live-share token for an invalid share id.");
  }
  return `${shareId}.${signatureFor(shareId, secret).toString("base64url")}`;
}

export function verifyShareToken(
  token: unknown,
  secret?: string,
): string | null {
  if (typeof token !== "string") return null;
  const match = TOKEN_PATTERN.exec(token);
  if (!match || !SHARE_ID_PATTERN.test(match[1]) || !SIGNATURE_PATTERN.test(match[2])) {
    return null;
  }

  const expected = signatureFor(match[1], secret);
  const actual = Buffer.from(match[2], "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }
  return match[1];
}
