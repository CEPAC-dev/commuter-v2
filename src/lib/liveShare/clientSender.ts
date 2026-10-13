import type { Locale } from "../i18n/config.ts";
import { ar } from "../i18n/messages/ar.ts";
import { en } from "../i18n/messages/en.ts";
import { MAX_LOCATION_ACCURACY_METERS } from "./logic.ts";

export const LOCATION_SEND_INTERVAL_MS = 10_000;
export const NETWORK_RETRY_BASE_MS = 1_000;
export const NETWORK_RETRY_MAX_MS = 30_000;

export type LocationErrorKind =
  | "permission"
  | "unavailable"
  | "timeout"
  | "weak_accuracy"
  | "ended"
  | "network"
  | "other";

export function getLocationSendDelayMs(
  now: number,
  lastAttemptAt: number | null,
  nextAfterMs = 0,
): number {
  if (lastAttemptAt === null) {
    return Number.isFinite(nextAfterMs) ? Math.max(0, nextAfterMs) : 0;
  }
  return Math.max(
    0,
    LOCATION_SEND_INTERVAL_MS - (now - lastAttemptAt),
    Number.isFinite(nextAfterMs) ? Math.max(0, nextAfterMs) : 0,
  );
}

export function shouldSendLocationNow(
  now: number,
  lastAttemptAt: number | null,
  nextAfterMs = 0,
): boolean {
  return getLocationSendDelayMs(now, lastAttemptAt, nextAfterMs) === 0;
}

export function getNetworkRetryDelayMs(attempt: number): number {
  const safeAttempt = Number.isFinite(attempt)
    ? Math.max(0, Math.floor(attempt))
    : 0;
  return Math.min(
    NETWORK_RETRY_MAX_MS,
    NETWORK_RETRY_BASE_MS * 2 ** Math.min(safeAttempt, 30),
  );
}

export function classifyLocationError(input: {
  geolocationCode?: number;
  accuracy?: number | null;
  status?: number;
  state?: string;
  errorCode?: string;
  network?: boolean;
}): LocationErrorKind {
  if (input.status === 409 || input.state === "ended") return "ended";
  if (input.errorCode === "LOCATION_ACCURACY_TOO_LOW") return "weak_accuracy";
  if (
    typeof input.accuracy === "number" &&
    input.accuracy > MAX_LOCATION_ACCURACY_METERS
  ) {
    return "weak_accuracy";
  }
  if (input.geolocationCode === 1) return "permission";
  if (input.geolocationCode === 2) return "unavailable";
  if (input.geolocationCode === 3) return "timeout";
  if (input.network || (input.status !== undefined && input.status >= 500)) {
    return "network";
  }
  return "other";
}

export function buildLiveShareText(locale: Locale, url: string): string {
  const message =
    locale === "ar" ? ar["live_share.share_message"] : en["live_share.share_message"];
  return message.replace("{url}", url);
}

export function buildWhatsAppShareUrl(locale: Locale, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(buildLiveShareText(locale, url))}`;
}

export function buildSmsShareUrl(locale: Locale, url: string): string {
  return `sms:?body=${encodeURIComponent(buildLiveShareText(locale, url))}`;
}
