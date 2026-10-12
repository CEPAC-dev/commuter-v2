import { validatePaymentAppUrl } from "@/lib/payments/sessionGuards";

export function getLiveShareBaseUrl(): string {
  const validation = validatePaymentAppUrl(process.env.APP_URL, {
    nodeEnv: process.env.NODE_ENV,
    appEnv: process.env.APP_ENV,
    kashierMode: process.env.KASHIER_MODE,
  });
  if (!validation.valid) {
    throw new Error("APP_URL is missing or invalid for live-share links.");
  }
  return validation.baseUrl;
}
