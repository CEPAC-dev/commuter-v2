export const ACTIVE_PAYMENT_STATUSES: string[] = [
  "created",
  "wallet_reserved",
  "kashier_pending",
];

export function isInFlightPaymentStatus(status: string): boolean {
  return ACTIVE_PAYMENT_STATUSES.includes(status);
}

export function shouldResetFailedTripForRetry(
  status: string,
  paymentStatus: string,
): boolean {
  return (
    paymentStatus === "failed" &&
    (status === "pending_payment" || status === "approved")
  );
}

export function canTripTakePaymentFailure(
  status: string,
  paymentStatus: string,
): boolean {
  return (
    paymentStatus !== "paid" &&
    (status === "pending_payment" || status === "approved")
  );
}

export async function runStandalonePaymentFailure(ops: {
  paymentInFlight: boolean;
  tripStatus: string;
  tripPaymentStatus: string;
  markPaymentFailed: () => Promise<boolean>;
  releaseWallet: () => Promise<void>;
  hasOtherInFlightPayment: () => Promise<boolean>;
  markTripFailed: () => Promise<void>;
  recordIgnored: () => Promise<void>;
}): Promise<"failed" | "ignored"> {
  if (
    !ops.paymentInFlight ||
    !canTripTakePaymentFailure(ops.tripStatus, ops.tripPaymentStatus)
  ) {
    await ops.recordIgnored();
    return "ignored";
  }
  if (!(await ops.markPaymentFailed())) {
    await ops.recordIgnored();
    return "ignored";
  }
  await ops.releaseWallet();
  if (!(await ops.hasOtherInFlightPayment())) await ops.markTripFailed();
  return "failed";
}

export async function runStandaloneSettlementSteps(steps: {
  captureWallet: () => Promise<void>;
  markPaymentPaid: () => Promise<void>;
  writeGatewayLedger: () => Promise<void>;
}): Promise<void> {
  await steps.captureWallet();
  await steps.markPaymentPaid();
  await steps.writeGatewayLedger();
}
