import type { Locale } from "./config";
import { MESSAGES, type MessageKey } from "./messages";

export type { Locale } from "./config";
export { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES, isLocale, parseLocale, localeDirection, intlLocale } from "./config";
export type { MessageKey } from "./messages";

const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** Converts any Western (0-9) digits in a string to Eastern Arabic-Indic digits. */
export function toArabicDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]);
}

/** Looks up a key; unknown keys fall back to English, then the raw key. */
export function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const raw = MESSAGES[locale][key as MessageKey] ?? MESSAGES.en[key as MessageKey] ?? key;
  const filled = !params
    ? raw
    : Object.entries(params).reduce(
        (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
        raw,
      );
  return locale === "ar" ? toArabicDigits(filled) : filled;
}

export function formatDate(locale: Locale, dateStr: string): string {
  const intl = locale === "ar" ? "ar-EG" : "en-EG";
  const out = new Date(`${dateStr}T12:00:00`).toLocaleDateString(intl, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return locale === "ar" ? toArabicDigits(out) : out;
}

const AR_AM = "ص";
const AR_PM = "م";

/** Renders "HH:MM" 24h as a locale-appropriate 12h string. */
export function formatTime(locale: Locale, hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const hour12 = h % 12 || 12;
  const minute = String(m).padStart(2, "0");
  if (locale === "ar") {
    return toArabicDigits(`${hour12}:${minute} ${h >= 12 ? AR_PM : AR_AM}`);
  }
  return `${hour12}:${minute} ${h >= 12 ? "PM" : "AM"}`;
}

export function formatDistanceKm(locale: Locale, km: number): string {
  const intl = locale === "ar" ? "ar-EG" : "en-EG";
  const out = `${km.toLocaleString(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${locale === "ar" ? "كم" : "km"}`;
  return locale === "ar" ? toArabicDigits(out) : out;
}

export function formatMinutes(locale: Locale, minutes: number): string {
  const out = `${Math.round(minutes)} ${translate(locale, "ride.minutes_short")}`;
  return locale === "ar" ? toArabicDigits(out) : out;
}

export function formatEgp(locale: Locale, amount: number): string {
  const intl = locale === "ar" ? "ar-EG" : "en-EG";
  const out = `${amount.toLocaleString(intl)} ${locale === "ar" ? "جنيه" : "EGP"}`;
  return locale === "ar" ? toArabicDigits(out) : out;
}
