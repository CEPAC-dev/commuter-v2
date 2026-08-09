"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, localeDirection, parseLocale, type Locale } from "./config";
import { translate } from "./index";

let localeListeners: Array<(locale: Locale) => void> = [];

function notifyLocaleChange(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = localeDirection(locale);
  localeListeners.forEach((listener) => listener(locale));
}

export function getLocaleFromCookie(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`));
  return parseLocale(cookie?.split("=")[1]);
}

export function setLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  notifyLocaleChange(locale);
}

/** initialLocale should come from getServerLocale() to avoid an English hydration flash. */
export function useClientLocale(initialLocale?: Locale) {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  useEffect(() => {
    const current = getLocaleFromCookie();
    setLocale(current);
    notifyLocaleChange(current);
  }, []);

  useEffect(() => {
    const listener = (nextLocale: Locale) => setLocale(nextLocale);
    localeListeners.push(listener);
    return () => {
      localeListeners = localeListeners.filter((item) => item !== listener);
    };
  }, []);

  const dir = useMemo(() => localeDirection(locale), [locale]);
  const t = useMemo(() => (key: string, params?: Record<string, string | number>) => translate(locale, key, params), [locale]);

  return { locale, dir, t } as const;
}
