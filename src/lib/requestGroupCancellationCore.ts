export class RequestGroupCancellationError extends Error {
  readonly code:
    | "REQUEST_NOT_FOUND"
    | "REQUEST_ALREADY_PAID"
    | "REQUEST_NOT_CANCELLABLE"
    | "TRIP_NOT_IN_REQUEST"
    | "TRIP_ALREADY_CANCELLED"
    | "PAYMENT_IN_PROGRESS"
    | "REQUEST_CHANGED";

  constructor(
    code: RequestGroupCancellationError["code"],
    message: string,
  ) {
    super(message);
    this.name = "RequestGroupCancellationError";
    this.code = code;
  }
}

export interface RequestGroupCancellationTrip {
  id: string;
  status: string;
  paymentStatus: string;
  priceEgp: number;
  date: string;
}

export interface RequestGroupCancellationRequest {
  id: string;
  userId: string;
  status: string;
  paymentStatus: string;
  amountEgp: number;
  kashierSessionId?: string | null;
  tripIds: string[];
}

export interface RequestGroupCancellationStore<TSession> {
  withTransaction<TResult>(
    work: (session: TSession) => Promise<TResult>,
  ): Promise<TResult>;
  getRequest(
    session: TSession,
    requestId: string,
    userId: string,
  ): Promise<RequestGroupCancellationRequest | null>;
  findTrips(
    session: TSession,
    requestId: string,
  ): Promise<RequestGroupCancellationTrip[]>;
  hasActivePayment(session: TSession, requestId: string): Promise<boolean>;
  cancelTrip(
    session: TSession,
    requestId: string,
    tripId: string,
    reason: string,
    now: Date,
  ): Promise<boolean>;
  cancelRemainingTrips(
    session: TSession,
    requestId: string,
    reason: string,
    now: Date,
  ): Promise<number>;
  updateRequest(
    session: TSession,
    requestId: string,
    userId: string,
    expected: { status: string; paymentStatus: string; amountEgp: number },
    update: {
      status: string;
      paymentStatus: string;
      amountEgp: number;
      kashierSessionId: null;
    },
  ): Promise<boolean>;
  releasePromos(session: TSession, requestId: string): Promise<number>;
}

function assertUnpaidRequest(
  request: RequestGroupCancellationRequest | null,
): asserts request is RequestGroupCancellationRequest {
  if (!request) {
    throw new RequestGroupCancellationError(
      "REQUEST_NOT_FOUND",
      "Request not found.",
    );
  }
  if (request.paymentStatus === "paid") {
    throw new RequestGroupCancellationError(
      "REQUEST_ALREADY_PAID",
      "This Request has already been paid and cannot use pre-payment cancellation.",
    );
  }
  if (
    !["pending", "failed"].includes(request.paymentStatus) ||
    ["cancelled", "rejected", "time_out"].includes(request.status)
  ) {
    throw new RequestGroupCancellationError(
      "REQUEST_NOT_CANCELLABLE",
      "This Request is no longer cancellable before payment.",
    );
  }
}

async function assertNoPaymentInProgress<TSession>(
  store: RequestGroupCancellationStore<TSession>,
  session: TSession,
  request: RequestGroupCancellationRequest,
): Promise<void> {
  if (await store.hasActivePayment(session, request.id)) {
    throw new RequestGroupCancellationError(
      "PAYMENT_IN_PROGRESS",
      "A payment session is still active. Try again after it expires (up to 35 minutes).",
    );
  }
}

function getRemainingTrips(
  trips: RequestGroupCancellationTrip[],
): RequestGroupCancellationTrip[] {
  return trips.filter((trip) => trip.status !== "cancelled");
}

function getAmount(trips: RequestGroupCancellationTrip[]): number {
  return trips.reduce((total, trip) => total + trip.priceEgp, 0);
}

function orderTrips(
  trips: RequestGroupCancellationTrip[],
): RequestGroupCancellationTrip[] {
  return [...trips].sort(
    (left, right) =>
      left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
  );
}

export async function cancelRequestDayWith<TSession>(
  store: RequestGroupCancellationStore<TSession>,
  input: {
    requestId: string;
    tripId: string;
    userId: string;
    reason?: string;
    now?: Date;
  },
) {
  return store.withTransaction(async (session) => {
    const request = await store.getRequest(session, input.requestId, input.userId);
    assertUnpaidRequest(request);
    await assertNoPaymentInProgress(store, session, request);

    const trips = await store.findTrips(session, request.id);
    const trip = trips.find((item) => item.id === input.tripId);
    if (!trip) {
      throw new RequestGroupCancellationError(
        "TRIP_NOT_IN_REQUEST",
        "The selected Trip does not belong to this Request.",
      );
    }
    if (trip.status === "cancelled") {
      throw new RequestGroupCancellationError(
        "TRIP_ALREADY_CANCELLED",
        "This day has already been cancelled.",
      );
    }

    const now = input.now ?? new Date();
    const reason = input.reason ?? "Passenger cancelled before payment";
    const cancelled = await store.cancelTrip(
      session,
      request.id,
      trip.id,
      reason,
      now,
    );
    if (!cancelled) {
      throw new RequestGroupCancellationError(
        "REQUEST_CHANGED",
        "This Request changed while cancellation was being processed.",
      );
    }

    const remainingTrips = getRemainingTrips(
      await store.findTrips(session, request.id),
    );
    const lastDay = remainingTrips.length === 0;
    const amountEgp = getAmount(remainingTrips);
    const updated = await store.updateRequest(
      session,
      request.id,
      input.userId,
      {
        status: request.status,
        paymentStatus: request.paymentStatus,
        amountEgp: request.amountEgp,
      },
      {
        status: lastDay ? "cancelled" : request.status,
        paymentStatus: lastDay ? "expired" : "pending",
        amountEgp,
        kashierSessionId: null,
      },
    );
    if (!updated) {
      throw new RequestGroupCancellationError(
        "REQUEST_CHANGED",
        "This Request changed while cancellation was being processed.",
      );
    }
    await store.releasePromos(session, request.id);

    return {
      requestId: request.id,
      status: lastDay ? "cancelled" : request.status,
      paymentStatus: lastDay ? "expired" : "pending",
      amountEgp,
      remainingTrips: orderTrips(remainingTrips),
      cancelledTripId: trip.id,
    };
  });
}

export async function cancelWholeRequestWith<TSession>(
  store: RequestGroupCancellationStore<TSession>,
  input: {
    requestId: string;
    userId: string;
    reason?: string;
    now?: Date;
  },
) {
  return store.withTransaction(async (session) => {
    const request = await store.getRequest(session, input.requestId, input.userId);
    assertUnpaidRequest(request);
    await assertNoPaymentInProgress(store, session, request);

    const now = input.now ?? new Date();
    const reason = input.reason ?? "Passenger cancelled Request before payment";
    const changed = await store.cancelRemainingTrips(
      session,
      request.id,
      reason,
      now,
    );
    const updated = await store.updateRequest(
      session,
      request.id,
      input.userId,
      {
        status: request.status,
        paymentStatus: request.paymentStatus,
        amountEgp: request.amountEgp,
      },
      {
        status: "cancelled",
        paymentStatus: "expired",
        amountEgp: 0,
        kashierSessionId: null,
      },
    );
    if (!updated) {
      throw new RequestGroupCancellationError(
        "REQUEST_CHANGED",
        "This Request changed while cancellation was being processed.",
      );
    }
    await store.releasePromos(session, request.id);

    return {
      requestId: request.id,
      status: "cancelled",
      paymentStatus: "expired",
      amountEgp: 0,
      cancelledTrips: changed,
    };
  });
}
