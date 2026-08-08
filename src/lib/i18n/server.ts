import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale, type Locale } from "./config";

/** Reads the locale cookie in a Server Component. Safe to call in async pages/layouts. */
export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  return parseLocale(store.get(LOCALE_COOKIE)?.value);
}
