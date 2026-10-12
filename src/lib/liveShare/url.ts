import { validatePaymentAppUrl } from "../payments/sessionGuards.ts";
import { LiveShareConfigError } from "./errors.ts";

export function getLiveShareBaseUrl(): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl?.trim()) {
    throw new LiveShareConfigError("LIVE_SHARE_APP_URL_MISSING");
  }
  const validation = validatePaymentAppUrl(appUrl.trim(), {
    nodeEnv: process.env.NODE_ENV,
    appEnv: process.env.APP_ENV,
    kashierMode: process.env.KASHIER_MODE,
  });
  if (!validation.valid) {
    throw new LiveShareConfigError("LIVE_SHARE_APP_URL_INVALID");
  }
  return validation.baseUrl;
}
