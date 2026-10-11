export type SingleTripPayloadError = "INVALID_TRIP_COUNT";

export function getSingleTripPayloadError(
  tripInstanceCount: number,
): SingleTripPayloadError | null {
  return tripInstanceCount === 1 ? null : "INVALID_TRIP_COUNT";
}

export function isTransientBookingConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    errorLabels?: unknown;
    hasErrorLabel?: (label: string) => boolean;
    cause?: unknown;
  };
  if (
    candidate.code === 112 ||
    candidate.code === 251 ||
    (Array.isArray(candidate.errorLabels) &&
      candidate.errorLabels.includes("TransientTransactionError")) ||
    candidate.hasErrorLabel?.("TransientTransactionError")
  ) {
    return true;
  }
  return candidate.cause !== error && isTransientBookingConflict(candidate.cause);
}

export function isAuthorizedExpiryRequest(
  secret: string | undefined,
  isProduction: boolean,
  authorization: string,
): boolean {
  if (!secret) return !isProduction;
  return authorization === `Bearer ${secret}`;
}

export function spacingLockUpsertFields(now: Date): {
  createdAt: Date;
  updatedAt: Date;
} {
  return { createdAt: now, updatedAt: now };
}

export function latePaymentDedupeKey(paymentId: string): string {
  return `late-payment:${paymentId}`;
}

export function safeKashierErrorFields(
  response: Record<string, unknown>,
): { code?: string; message?: string; orderId?: string } {
  const nested =
    response.data && typeof response.data === "object"
      ? (response.data as Record<string, unknown>)
      : {};
  const result: { code?: string; message?: string; orderId?: string } = {};
  const code = nested.errorCode ?? nested.code ?? response.errorCode ?? response.code;
  const message = nested.message ?? response.message;
  const orderId = nested.orderId ?? response.orderId ?? response.merchantOrderId;
  if (typeof code === "string") result.code = code.slice(0, 80);
  if (typeof message === "string") result.message = message.slice(0, 240);
  if (typeof orderId === "string") result.orderId = orderId.slice(0, 100);
  return result;
}
