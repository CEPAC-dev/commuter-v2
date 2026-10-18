export type RequestSettlementFlowResult =
  | "settled"
  | "already_settled"
  | "not_settled"
  | "capture_failed";

export interface RequestSettlementFlowOperations {
  withTransaction(work: () => Promise<void>): Promise<void>;
  isAlreadySettled(): Promise<boolean>;
  claimRequest(): Promise<boolean>;
  updateChildren(): Promise<void>;
  captureWallet?: () => Promise<number | null>;
  finalizePayment?: () => Promise<void>;
  recordWebhookEvent?: (transactionId?: string) => Promise<void>;
}

class ReservationCaptureFailed extends Error {}

export async function runRequestSettlementWith(
  operations: RequestSettlementFlowOperations,
  transactionId?: string,
): Promise<RequestSettlementFlowResult> {
  let result: RequestSettlementFlowResult = "not_settled";
  try {
    await operations.withTransaction(async () => {
      result = "not_settled";
      if (await operations.isAlreadySettled()) {
        result = "already_settled";
        return;
      }
      if (!(await operations.claimRequest())) return;

      await operations.updateChildren();
      if (operations.captureWallet) {
        const captured = await operations.captureWallet();
        if (captured === null) throw new ReservationCaptureFailed();
      }
      if (operations.finalizePayment) await operations.finalizePayment();
      if (operations.recordWebhookEvent)
        await operations.recordWebhookEvent(transactionId);
      result = "settled";
    });
  } catch (error) {
    if (error instanceof ReservationCaptureFailed) return "capture_failed";
    throw error;
  }
  return result;
}
