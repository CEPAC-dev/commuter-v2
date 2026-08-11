export type PromoExpiryInput = Date | string | null | undefined;

export function isPromoCodeExpired(
  expiresAt: PromoExpiryInput,
  nowMs = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const expiresAtMs =
    expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return false;
  return nowMs >= expiresAtMs;
}

export function hasPromoLimitingFactor(
  maxUses: number | null | undefined,
  expiresAt: PromoExpiryInput,
): boolean {
  const hasUsageLimit = typeof maxUses === "number" && maxUses > 0;
  return hasUsageLimit || Boolean(expiresAt);
}

export function computePromoExpiryFromDuration(duration: {
  days: number;
  hours: number;
  minutes: number;
}): Date | null {
  const totalSeconds =
    duration.days * 86400 + duration.hours * 3600 + duration.minutes * 60;
  if (totalSeconds <= 0) return null;
  return new Date(Date.now() + totalSeconds * 1000);
}
