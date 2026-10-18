export const LIVE_SHARE_CONSENT_VERSION = "2026-10-v2";

export type LiveShareConsentResult =
  | {
      valid: true;
      consentAt: Date;
      consentVersion: typeof LIVE_SHARE_CONSENT_VERSION;
    }
  | {
      valid: false;
      errorCode:
        | "LIVE_SHARE_CONSENT_REQUIRED"
        | "LIVE_SHARE_CONSENT_VERSION_MISMATCH";
    };

export function validateLiveShareConsent(
  input: unknown,
  consentAt = new Date(),
): LiveShareConsentResult {
  if (!input || typeof input !== "object" || !("consent" in input) || input.consent !== true) {
    return { valid: false, errorCode: "LIVE_SHARE_CONSENT_REQUIRED" };
  }
  if (
    !("consentVersion" in input) ||
    input.consentVersion !== LIVE_SHARE_CONSENT_VERSION
  ) {
    return { valid: false, errorCode: "LIVE_SHARE_CONSENT_VERSION_MISMATCH" };
  }
  return {
    valid: true,
    consentAt,
    consentVersion: LIVE_SHARE_CONSENT_VERSION,
  };
}
