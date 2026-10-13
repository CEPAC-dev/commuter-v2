export interface StandaloneTripCancellationRecord {
  id: string;
  status: string;
  paymentStatus: string;
  requestId?: unknown;
}

export function isStandaloneTripForCancellation(
  trip: Pick<StandaloneTripCancellationRecord, "requestId">,
): boolean {
  return trip.requestId == null;
}

export function buildPassengerTripCancellationFilter(
  tripId: string,
  userId: string,
) {
  return { _id: tripId, userId };
}

export type StandaloneTripCancellationMode =
  | { kind: "unpaid" }
  | { kind: "paid" }
  | {
      kind: "blocked";
      httpStatus: 400 | 409;
      errorCode: string;
      error: string;
    };

export function getStandaloneTripCancellationMode(
  trip: StandaloneTripCancellationRecord,
): StandaloneTripCancellationMode {
  if (trip.status === "cancelled") {
    return {
      kind: "blocked",
      httpStatus: 400,
      errorCode: "TRIP_ALREADY_CANCELLED",
      error: "This trip is already cancelled",
    };
  }
  if (trip.status === "completed") {
    return {
      kind: "blocked",
      httpStatus: 400,
      errorCode: "TRIP_COMPLETED",
      error: "Completed trips cannot be cancelled",
    };
  }
  if (trip.status === "active") {
    return {
      kind: "blocked",
      httpStatus: 400,
      errorCode: "TRIP_ACTIVE",
      error: "Active trips cannot be cancelled",
    };
  }
  if (trip.status === "rejected") {
    return {
      kind: "blocked",
      httpStatus: 409,
      errorCode: "REQUEST_NOT_CANCELLABLE",
      error: "Trips in waiting or rejected requests cannot be cancelled individually.",
    };
  }
  if (trip.status === "time_out" || trip.status === "refunded" ||
      trip.paymentStatus === "refunded") {
    return {
      kind: "blocked",
      httpStatus: 409,
      errorCode: "TRIP_NOT_PAID",
      error: "This trip has not been paid for, so it cannot be cancelled.",
    };
  }
  if (
    ["waiting_list", "pending_payment", "approved"].includes(trip.status) &&
    ["pending", "failed"].includes(trip.paymentStatus)
  ) {
    return { kind: "unpaid" };
  }
  if (trip.paymentStatus === "paid") {
    return { kind: "paid" };
  }
  return {
    kind: "blocked",
    httpStatus: 409,
    errorCode: "TRIP_NOT_PAID",
    error: "This trip has not been paid for, so it cannot be cancelled.",
  };
}

export async function runStandaloneTripCancellation<TTrip>(
  input: {
    trip: StandaloneTripCancellationRecord;
    reason: string;
    evaluation: {
      tierLabel: string;
      refundPercent: number;
      penaltyPercent: number;
      refundAmount: number;
      retainedAmount: number;
    };
    store: {
      cancelUnpaidTrip(
        trip: StandaloneTripCancellationRecord,
        reason: string,
      ): Promise<TTrip | null>;
      cancelPaidTrip(
        trip: StandaloneTripCancellationRecord,
        reason: string,
        evaluation: {
          tierLabel: string;
          refundPercent: number;
          penaltyPercent: number;
          refundAmount: number;
          retainedAmount: number;
        },
      ): Promise<TTrip | null>;
    };
    cancelPayments(tripId: string): Promise<void>;
  },
): Promise<
  | { ok: true; kind: "unpaid" | "paid"; trip: TTrip }
  | {
      ok: false;
      httpStatus: 400 | 409;
      errorCode: string;
      error: string;
    }
> {
  const mode = getStandaloneTripCancellationMode(input.trip);
  if (mode.kind === "blocked") return { ok: false, ...mode };

  const trip = mode.kind === "unpaid"
    ? await input.store.cancelUnpaidTrip(input.trip, input.reason)
    : await input.store.cancelPaidTrip(
        input.trip,
        input.reason,
        input.evaluation,
      );
  if (!trip) {
    return {
      ok: false,
      httpStatus: 409,
      errorCode: "TRIP_CANCELLATION_CONFLICT",
      error: "This trip has already changed and cannot be cancelled.",
    };
  }

  if (mode.kind === "unpaid") {
    await input.cancelPayments(input.trip.id);
  }
  return { ok: true, kind: mode.kind, trip };
}
