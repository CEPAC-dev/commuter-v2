export const REFERRAL_DESCRIPTION_CATEGORIES = [
  "referrer_bonus",
  "welcome_referral_bonus",
  "admin_referral_welcome_bonus",
] as const;

export type ReferralDescriptionCategory =
  (typeof REFERRAL_DESCRIPTION_CATEGORIES)[number];

const REFERRAL_DESCRIPTION_PATTERNS: Record<
  ReferralDescriptionCategory,
  RegExp
> = {
  referrer_bonus: /^Referral bonus(?: \(reconciled\))?$/i,
  welcome_referral_bonus: /^Welcome referral bonus(?: \(reconciled\))?$/i,
  admin_referral_welcome_bonus:
    /^Admin referral welcome bonus(?: \(reconciled\))?$/i,
};

export function isReferralDescriptionCategory(
  value: string | null,
): value is ReferralDescriptionCategory {
  return REFERRAL_DESCRIPTION_CATEGORIES.some((category) => category === value);
}

export function referralDescriptionPattern(
  category: ReferralDescriptionCategory,
): RegExp {
  return REFERRAL_DESCRIPTION_PATTERNS[category];
}

export function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
