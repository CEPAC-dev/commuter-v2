import type { ClientSession, HydratedDocument } from "mongoose";
import type { RequestDoc } from "@/models/Request";
import {
  createTripBatchWith,
  type TripBatchCreationStore,
  type TripBatchCandidate,
  type PreparedTripBatchCandidate,
} from "./tripBatchCreation.ts";

export class InvalidRequestGroupError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRequestGroupError";
  }
}

export class RequestGroupPromoError extends Error {
  constructor(message: string) {
    super(message || "Promo could not be applied to every Request child");
    this.name = "RequestGroupPromoError";
  }
}

export interface RequestGroupCreationStore<TSession, TDocument, TRequest>
  extends TripBatchCreationStore<TSession, TDocument> {
  saveRequest(session: TSession, request: TRequest): Promise<void>;
}

type RequestGroupInput<TSession, TDocument, TRequest, TPayload> = {
  userId: string;
  dates: readonly string[];
  allowedDates: readonly string[];
  routeCount: number;
  cycleCount: number;
  candidates: readonly TripBatchCandidate<TPayload>[];
  maxPendingUnpaidTrips: number;
  promoCode: string | null;
  computeDiscountedPrice: (
    basePriceEgp: number,
    discountType: "percentage" | "fixed",
    discountValue: number,
  ) => number;
  buildDocument: (
    candidate: PreparedTripBatchCandidate<TPayload>,
    session: TSession,
  ) => Promise<TDocument>;
  buildRequest: (
    candidates: readonly PreparedTripBatchCandidate<TPayload>[],
    documents: readonly TDocument[],
    amountEgp: number,
  ) => TRequest;
};

export async function createRequestGroupWith<
  TSession,
  TDocument,
  TRequest,
  TPayload,
>(
  store: RequestGroupCreationStore<TSession, TDocument, TRequest>,
  input: RequestGroupInput<TSession, TDocument, TRequest, TPayload>,
) {
  if (
    input.dates.length < 2 ||
    input.dates.length > 7 ||
    new Set(input.dates).size !== input.dates.length ||
    input.routeCount !== 1 ||
    input.cycleCount !== 1 ||
    input.candidates.length !== input.dates.length ||
    input.dates.some(
      (date) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !input.allowedDates.includes(date),
    ) ||
    new Set(input.candidates.map((candidate) => candidate.date)).size !==
      input.dates.length ||
    input.candidates.some((candidate) => !input.dates.includes(candidate.date))
  ) {
    throw new InvalidRequestGroupError("Invalid multi-day Request");
  }

  const requestRef: { value: TRequest | null } = { value: null };
  const preparedCandidatesById = new Map<
    string,
    PreparedTripBatchCandidate<TPayload>
  >();
  const result = await createTripBatchWith<TSession, TDocument, TPayload>(
    {
      withTransaction: (work) => store.withTransaction(work),
      acquireLocks: (session, dates) => store.acquireLocks(session, dates),
      countPendingUnpaid: (session, userId) =>
        store.countPendingUnpaid(session, userId),
      findSpacingWindows: (session, userId, dates) =>
        store.findSpacingWindows(session, userId, dates),
      async applyPromo(session, userId, tripId) {
        const result = await store.applyPromo(session, userId, tripId);
        if (input.promoCode && !result.success) {
          throw new RequestGroupPromoError(result.message);
        }
        return result;
      },
      async insert(session, documents) {
        const preparedCandidates = input.candidates.map((candidate) => {
          const prepared = preparedCandidatesById.get(candidate.id);
          if (!prepared) {
            throw new Error("A Request child was not prepared");
          }
          return prepared;
        });
        const amountEgp = preparedCandidates.reduce(
          (total, candidate) => total + candidate.priceEgp,
          0,
        );
        const request = input.buildRequest(
          preparedCandidates,
          documents,
          amountEgp,
        );
        requestRef.value = request;
        await store.saveRequest(session, request);
        await store.insert(session, documents);
      },
    },
    {
      userId: input.userId,
      dates: input.dates,
      candidates: input.candidates,
      maxPendingUnpaidTrips: input.maxPendingUnpaidTrips,
      promoCode: input.promoCode,
      computeDiscountedPrice: input.computeDiscountedPrice,
      async buildDocument(candidate, session) {
        preparedCandidatesById.set(candidate.id, candidate);
        return input.buildDocument(candidate, session);
      },
    },
  );
  if (!requestRef.value) throw new Error("Request group was not created");
  return { ...result, request: requestRef.value };
}

export async function saveRequestGroup(
  request: HydratedDocument<RequestDoc>,
  session: ClientSession,
): Promise<void> {
  if (!session.inTransaction()) {
    throw new Error("Request group creation requires an active transaction");
  }
  request.$locals.groupCreationApproved = true;
  request.$session(session);
  await request.save({ session });
}
