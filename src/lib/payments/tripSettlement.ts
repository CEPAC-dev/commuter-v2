export type TripSettlementOutcome =
  | "settled"
  | "incomplete"
  | "already_paid"
  | "blocked"
  | "missing";

interface SettlementState {
  paymentStatus: string;
  status: string;
}

export function isTripSettlementBlockedStatus(status: string): boolean {
  return ["cancelled", "time_out", "rejected"].includes(status);
}

export async function settleTripOnce<T>(
  claim: () => Promise<T | null>,
  readCurrent: () => Promise<SettlementState | null>,
  afterClaim: (trip: NonNullable<T>) => Promise<void | boolean>,
): Promise<TripSettlementOutcome> {
  const trip = await claim();
  if (trip) {
    const completed = await afterClaim(trip);
    return completed === false ? "incomplete" : "settled";
  }

  const current = await readCurrent();
  if (!current) return "missing";
  if (current.paymentStatus === "paid") return "already_paid";
  if (isTripSettlementBlockedStatus(current.status)) return "blocked";
  return "missing";
}

export function fullyRefundedTripUpdate(
  refundedAmountEgp: number,
  priceEgp: number,
): { status: "refunded"; paymentStatus: "refunded" } | null {
  return priceEgp > 0 && refundedAmountEgp >= priceEgp
    ? { status: "refunded", paymentStatus: "refunded" }
    : null;
}
