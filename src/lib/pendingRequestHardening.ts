export const SETTLEMENT_BLOCKED_STATUSES = [
  "waiting_list",
  "rejected",
] as const;

export function buildPendingRequestExpiryFilter(
  cutoff: Date,
  userId?: string,
): Record<string, unknown> {
  return {
    ...(userId ? { userId } : {}),
    status: "pending_payment",
    paymentStatus: { $in: ["pending", "failed"] },
    createdAt: { $lte: cutoff },
  };
}

export function buildPendingTripExpiryFilter(
  requestIds: readonly unknown[],
): Record<string, unknown> {
  return {
    requestId: { $in: requestIds },
    status: "pending_payment",
  };
}

export function buildSettlementRequestFilter(
  bookingId: unknown,
  paymentStatuses: readonly string[] = ["pending", "failed"],
): Record<string, unknown> {
  return {
    _id: bookingId,
    paymentStatus: { $in: paymentStatuses },
    status: { $nin: [...SETTLEMENT_BLOCKED_STATUSES] },
  };
}

export function isSettlementBlockedStatus(status: unknown): boolean {
  return (
    status === SETTLEMENT_BLOCKED_STATUSES[0] ||
    status === SETTLEMENT_BLOCKED_STATUSES[1]
  );
}