import { getCurrencyConfig, type RegionCode } from "./config/regions.ts";

export function formatMoney(
  locale: "en" | "ar",
  amount: number,
  region: RegionCode,
): string {
  const currency = getCurrencyConfig(region);
  const country =
    region === "SA" ? "SA" : region === "AE-ABU-DHABI" ? "AE" : "EG";
  return new Intl.NumberFormat(
    locale === "ar" ? `ar-${country}` : currency.locale,
    {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: currency.decimalDigits,
      maximumFractionDigits: currency.decimalDigits,
    },
  ).format(amount);
}
