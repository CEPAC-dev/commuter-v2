export type RequestPaymentSessionBlock =
  | "REQUEST_WAITING_LIST"
  | "REQUEST_REJECTED"
  | "REQUEST_CANCELLED"
  | "REQUEST_NOT_PAYABLE"
  | "REQUEST_NO_REMAINING_TRIPS"
  | "REQUEST_AMOUNT_MISMATCH";

interface RequestPaymentSessionState {
  status: string;
  paymentStatus: string;
  amountEgp: number;
}

interface RequestPaymentSessionTrip {
  status: string;
  priceEgp: number;
}

export function getRequestPaymentSessionBlock(
  request: RequestPaymentSessionState,
  trips: readonly RequestPaymentSessionTrip[],
): RequestPaymentSessionBlock | null {
  if (request.status === "waiting_list") return "REQUEST_WAITING_LIST";
  if (request.status === "rejected") return "REQUEST_REJECTED";
  if (request.status === "cancelled" || request.status === "time_out") {
    return "REQUEST_CANCELLED";
  }
  if (!["pending_payment", "approved"].includes(request.status)) {
    return "REQUEST_NOT_PAYABLE";
  }
  if (!["pending", "failed"].includes(request.paymentStatus)) {
    return "REQUEST_NOT_PAYABLE";
  }

  const remainingTrips = trips.filter((trip) => trip.status !== "cancelled");
  if (remainingTrips.length === 0) return "REQUEST_NO_REMAINING_TRIPS";

  const currentAmount = remainingTrips.reduce(
    (total, trip) => total + trip.priceEgp,
    0,
  );
  if (currentAmount !== request.amountEgp) return "REQUEST_AMOUNT_MISMATCH";

  return null;
}
