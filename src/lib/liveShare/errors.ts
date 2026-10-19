export type LiveShareConfigErrorCode =
  | "LIVE_SHARE_SECRET_MISSING"
  | "LIVE_SHARE_SECRET_TOO_SHORT"
  | "LIVE_SHARE_SECRET_INVALID_FORMAT"
  | "LIVE_SHARE_APP_URL_MISSING"
  | "LIVE_SHARE_APP_URL_INVALID";

export class LiveShareConfigError extends Error {
  readonly code: LiveShareConfigErrorCode;

  constructor(code: LiveShareConfigErrorCode) {
    super(code);
    this.name = "LiveShareConfigError";
    this.code = code;
  }
}

export function isLiveShareConfigError(
  error: unknown,
): error is LiveShareConfigError {
  return error instanceof LiveShareConfigError;
}

export function logLiveShareFailure(routeLabel: string, error: unknown): void {
  const errorName =
    error instanceof Error && typeof error.name === "string"
      ? error.name
      : "UnknownError";
  if (isLiveShareConfigError(error)) {
    console.error(routeLabel, errorName, error.code);
    return;
  }
  console.error(routeLabel, errorName);
}
