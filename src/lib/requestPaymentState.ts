export interface RequestPaymentStateInput {
  status?: string | null;
  paymentStatus?: string | null;
  hasPastTrip?: boolean;
  rejectionReason?: string | null;
}

export interface RequestPaymentState {
  kind: "waiting_list" | "approved" | "approved_past" | "rejected" | "other";
  showPayButton: boolean;
  statusLabelKey: string | null;
  explanationKey: string | null;
  rejectionReason: string | null;
}

export function wasMoneyTaken(paymentState?: string | null): boolean {
  return [
    "paid",
    "refunded",
    "partially_refunded",
    "captured",
    "success",
  ].includes(paymentState ?? "");
}

export function getRequestPaymentState(
  request: RequestPaymentStateInput,
): RequestPaymentState {
  const unpaid =
    request.paymentStatus === "pending" || request.paymentStatus === "failed";

  if (request.status === "waiting_list") {
    return {
      kind: "waiting_list",
      showPayButton: false,
      statusLabelKey: "request_status.waiting_for_approval",
      explanationKey: "request_status.waiting_payment_explanation",
      rejectionReason: null,
    };
  }

  if (request.status === "approved") {
    if (request.hasPastTrip) {
      return {
        kind: "approved_past",
        showPayButton: false,
        statusLabelKey: "request_status.approved_past_trip",
        explanationKey: null,
        rejectionReason: null,
      };
    }

    return {
      kind: "approved",
      showPayButton: unpaid,
      statusLabelKey: "request_status.approved_pay_now",
      explanationKey: null,
      rejectionReason: null,
    };
  }

  if (request.status === "rejected") {
    return {
      kind: "rejected",
      showPayButton: false,
      statusLabelKey: "request_status.rejected",
      explanationKey: null,
      rejectionReason: request.rejectionReason?.trim() || null,
    };
  }

  return {
    kind: "other",
    showPayButton: unpaid,
    statusLabelKey: null,
    explanationKey: null,
    rejectionReason: null,
  };
}