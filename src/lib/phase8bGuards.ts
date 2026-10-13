export function isTransientBookingConflict(error: unknown): boolean {
  const chain: {
    code?: unknown;
    errorLabels?: unknown;
    hasErrorLabel?: (label: string) => boolean;
    cause?: unknown;
  }[] = [];
  let current: unknown = error;
  while (current && typeof current === "object" && !chain.includes(current)) {
    const candidate = current as (typeof chain)[number];
    chain.push(candidate);
    current = candidate.cause;
  }

  const hasLabel = (label: string) =>
    chain.some(
      (candidate) =>
        (Array.isArray(candidate.errorLabels) &&
          candidate.errorLabels.includes(label)) ||
        candidate.hasErrorLabel?.(label) === true,
    );
  if (
    hasLabel("TransientTransactionError") ||
    hasLabel("UnknownTransactionCommitResult")
  )
    return true;
  return chain.some((candidate) => candidate.code === 112);
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
): {
  code?: string;
  message?: string;
  orderId?: string;
  responseKeys?: string[];
} {
  const nested =
    response.data && typeof response.data === "object"
      ? (response.data as Record<string, unknown>)
      : {};
  const result: {
    code?: string;
    message?: string;
    orderId?: string;
    responseKeys?: string[];
  } = {};
  const code = nested.errorCode ?? nested.code ?? response.errorCode ?? response.code;
  const message = nested.message ?? response.message;
  const orderId = nested.orderId ?? response.orderId ?? response.merchantOrderId;
  if (typeof code === "string") result.code = code.slice(0, 80);
  if (typeof message === "string") result.message = message.slice(0, 240);
  if (typeof orderId === "string") result.orderId = orderId.slice(0, 100);
  if (Object.keys(result).length === 0) {
    result.responseKeys = Object.keys(response)
      .slice(0, 20)
      .map((key) => key.slice(0, 80));
  }
  return result;
}
