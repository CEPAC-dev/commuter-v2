export type RequestPaymentRecoveryIssue =
  | "request_not_found"
  | "request_cancelled"
  | "request_expired"
  | "request_already_paid"
  | "request_not_payable"
  | "payment_not_recoverable"
  | "late_payment_amount_mismatch"
  | "wallet_reservation_released"
  | "amount_mismatch"
  | "settlement_not_applied";

export interface RequestPaymentRecoveryInput {
  request: {
    status: string;
    paymentStatus: string;
  } | null;
  payment: {
    overallStatus: string;
    totalEgp: number;
    walletAmountEgp: number;
    walletStatus: string;
  };
  expectedAmountEgp: number;
}

export interface RequestPaymentRecoveryOperations<TResult extends string> {
  settle(): Promise<TResult>;
  getExpectedAmountEgp?(): Promise<number>;
  recordIssue(input: {
    issue: RequestPaymentRecoveryIssue;
    paidAmountEgp: number;
    expectedAmountEgp: number;
    manualReview: boolean;
  }): Promise<void>;
}

const ACTIVE_PAYMENT_STATUSES = new Set([
  "created",
  "wallet_reserved",
  "kashier_pending",
]);

function getUnsettleableReason(
  input: RequestPaymentRecoveryInput,
): RequestPaymentRecoveryIssue | null {
  const { request, payment } = input;
  if (!request) return "request_not_found";
  if (request.status === "cancelled") return "request_cancelled";
  if (request.status === "time_out" || request.paymentStatus === "expired") {
    return "request_expired";
  }
  if (request.paymentStatus === "paid") return "request_already_paid";
  if (
    request.status === "waiting_list" ||
    request.status === "rejected" ||
    !["pending", "failed"].includes(request.paymentStatus)
  ) {
    return "request_not_payable";
  }
  if (
    !ACTIVE_PAYMENT_STATUSES.has(payment.overallStatus) &&
    !["failed", "cancelled"].includes(payment.overallStatus)
  ) {
    return "payment_not_recoverable";
  }
  if (
    payment.walletAmountEgp > 0 &&
    !["reserved", "captured"].includes(payment.walletStatus)
  ) {
    return "wallet_reservation_released";
  }
  if (
    !ACTIVE_PAYMENT_STATUSES.has(payment.overallStatus) &&
    payment.totalEgp !== input.expectedAmountEgp
  ) {
    return "late_payment_amount_mismatch";
  }
  return null;
}

export async function recoverPaidRequestPayment<TResult extends string>(
  input: RequestPaymentRecoveryInput,
  operations: RequestPaymentRecoveryOperations<TResult>,
): Promise<"manual_review" | "settled" | "settled_with_mismatch" | "already_processed" | TResult> {
  const getCurrentExpectedAmount = () =>
    operations.getExpectedAmountEgp
      ? operations.getExpectedAmountEgp()
      : Promise.resolve(input.expectedAmountEgp);

  if (
    input.request?.paymentStatus === "paid" &&
    input.payment.overallStatus === "paid" &&
    !["cancelled", "time_out", "waiting_list", "rejected"].includes(
      input.request.status,
    )
  ) {
    const currentExpectedAmountEgp = await getCurrentExpectedAmount();
    if (input.payment.totalEgp !== currentExpectedAmountEgp) {
      await operations.recordIssue({
        issue: "amount_mismatch",
        paidAmountEgp: input.payment.totalEgp,
        expectedAmountEgp: currentExpectedAmountEgp,
        manualReview: false,
      });
    }
    return "already_processed";
  }

  const issue = getUnsettleableReason(input);
  const paidAmountEgp = input.payment.totalEgp;
  const expectedAmountEgp = input.expectedAmountEgp;

  if (issue) {
    await operations.recordIssue({
      issue,
      paidAmountEgp,
      expectedAmountEgp,
      manualReview: true,
    });
    return "manual_review";
  }

  const settlement = await operations.settle();
  if (settlement === "capture_failed") return settlement;
  if (settlement === "not_settled") {
    const currentExpectedAmountEgp = await getCurrentExpectedAmount();
    if (
      !ACTIVE_PAYMENT_STATUSES.has(input.payment.overallStatus) &&
      paidAmountEgp !== currentExpectedAmountEgp
    ) {
      await operations.recordIssue({
        issue: "late_payment_amount_mismatch",
        paidAmountEgp,
        expectedAmountEgp: currentExpectedAmountEgp,
        manualReview: true,
      });
      return "manual_review";
    }
    await operations.recordIssue({
      issue: "settlement_not_applied",
      paidAmountEgp,
      expectedAmountEgp: currentExpectedAmountEgp,
      manualReview: true,
    });
    return "manual_review";
  }
  const currentExpectedAmountEgp = await getCurrentExpectedAmount();
  const currentMismatch = paidAmountEgp !== currentExpectedAmountEgp;
  if (currentMismatch) {
    await operations.recordIssue({
      issue: "amount_mismatch",
      paidAmountEgp,
      expectedAmountEgp: currentExpectedAmountEgp,
      manualReview: false,
    });
    return "settled_with_mismatch";
  }
  return settlement === "already_settled" ? "already_processed" : "settled";
}
