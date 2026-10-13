export const KASHIER_SESSION_DURATION_MS = 30 * 60 * 1000;
export const PAYMENT_CANCELLATION_GRACE_MS = 5 * 60 * 1000;

export function isRequestPaymentSessionExpired(
  createdAt: Date,
  now: Date,
): boolean {
  return (
    now.getTime() >=
    createdAt.getTime() +
      KASHIER_SESSION_DURATION_MS +
      PAYMENT_CANCELLATION_GRACE_MS
  );
}

export async function verifyExpiredRequestPayments(
  payments: readonly { id: string; createdAt: Date }[],
  now: Date,
  verify: (paymentId: string) => Promise<unknown>,
): Promise<void> {
  for (const payment of payments) {
    if (isRequestPaymentSessionExpired(payment.createdAt, now)) {
      await verify(payment.id);
    }
  }
}
