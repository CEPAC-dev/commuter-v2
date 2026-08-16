export type Locale = "en" | "ar";

export const SUPPORTED_LOCALES: Locale[] = ["en", "ar"];
export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ar";
}

export function parseLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function localeDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function intlLocale(locale: Locale): "en-EG" | "ar-EG" {
  return locale === "ar" ? "ar-EG" : "en-EG";
}
