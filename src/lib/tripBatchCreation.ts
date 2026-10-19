import {
  findSpacingConflict,
  type TripSpacingWindow,
} from "./validation/tripSpacing.ts";
import { MAX_BOOKING_DATES } from "./tripBooking.ts";

export type PromoDiscountType = "percentage" | "fixed";

export type TripBatchPromoResult =
  | {
      success: true;
      discountType: PromoDiscountType;
      discountValue: number;
      promoCodeId: string;
      usageId: string;
    }
  | { success: false; message: string };

export interface TripBatchCandidate<TPayload> {
  id: string;
  date: string;
  arrivalTime: string;
  basePriceEgp: number;
  payload: TPayload;
}

export interface PreparedTripBatchCandidate<TPayload>
  extends TripBatchCandidate<TPayload> {
  priceEgp: number;
  promoApply: Extract<TripBatchPromoResult, { success: true }> | null;
  promoDiscountAmountEgp: number;
}

export interface TripBatchCreationStore<TSession, TDocument> {
  withTransaction<TResult>(
    work: (session: TSession) => Promise<TResult>,
  ): Promise<TResult>;
  acquireLocks(session: TSession, dates: readonly string[]): Promise<void>;
  countPendingUnpaid(session: TSession, userId: string): Promise<number>;
  findSpacingWindows(
    session: TSession,
    userId: string,
    dates: readonly string[],
  ): Promise<TripSpacingWindow[]>;
  applyPromo(
    session: TSession,
    userId: string,
    tripId: string,
  ): Promise<TripBatchPromoResult>;
  insert(session: TSession, documents: TDocument[]): Promise<void>;
}

export class TripBatchSpacingConflictError extends Error {
  readonly conflict: NonNullable<ReturnType<typeof findSpacingConflict>>;

  constructor(conflict: NonNullable<ReturnType<typeof findSpacingConflict>>) {
    super("Trip arrival window conflicts with another trip");
    this.conflict = conflict;
  }
}

export class TooManyPendingTripsError extends Error {
  constructor() {
    super("Too many pending trips");
  }
}

export async function createTripBatchWith<TSession, TDocument, TPayload>(
  store: TripBatchCreationStore<TSession, TDocument>,
  input: {
    userId: string;
    dates: readonly string[];
    candidates: readonly TripBatchCandidate<TPayload>[];
    maxPendingUnpaidTrips: number;
    promoCode: string | null;
    computeDiscountedPrice: (
      basePriceEgp: number,
      discountType: PromoDiscountType,
      discountValue: number,
    ) => number;
    buildDocument: (
      candidate: PreparedTripBatchCandidate<TPayload>,
      session: TSession,
    ) => Promise<TDocument>;
  },
): Promise<{
  candidates: PreparedTripBatchCandidate<TPayload>[];
  documents: TDocument[];
  promoFailureMessage: string;
}> {
  if (
    input.dates.length === 0 ||
    input.dates.length > MAX_BOOKING_DATES ||
    input.candidates.length !== input.dates.length ||
    new Set(input.dates).size !== input.dates.length ||
    input.candidates.some(
      (candidate) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(candidate.date) ||
        !input.dates.includes(candidate.date) ||
        !Number.isFinite(candidate.basePriceEgp) ||
        candidate.basePriceEgp < 0,
    )
  ) {
    throw new RangeError("Invalid trip batch candidates");
  }

  return store.withTransaction(async (session) => {
    await store.acquireLocks(session, input.dates);

    const pendingCount = await store.countPendingUnpaid(session, input.userId);
    if (pendingCount + input.candidates.length > input.maxPendingUnpaidTrips) {
      throw new TooManyPendingTripsError();
    }

    const existingWindows = await store.findSpacingWindows(
      session,
      input.userId,
      input.dates,
    );
    const submittedWindows: TripSpacingWindow[] = [];
    for (const candidate of input.candidates) {
      const proposed = { date: candidate.date, arrivalTime: candidate.arrivalTime };
      const conflict = findSpacingConflict(proposed, [
        ...existingWindows,
        ...submittedWindows,
      ]);
      if (conflict) throw new TripBatchSpacingConflictError(conflict);
      submittedWindows.push({ ...proposed, status: "pending_payment" });
    }

    let promoFailureMessage = "";
    const candidates: PreparedTripBatchCandidate<TPayload>[] = [];
    for (const candidate of input.candidates) {
      let promoApply: PreparedTripBatchCandidate<TPayload>["promoApply"] = null;
      if (input.promoCode) {
        const result = await store.applyPromo(
          session,
          input.userId,
          candidate.id,
        );
        if (result.success) {
          promoApply = result;
        } else if (!promoFailureMessage) {
          promoFailureMessage = result.message;
        }
      }

      const priceEgp = promoApply
        ? Math.round(
            input.computeDiscountedPrice(
              candidate.basePriceEgp,
              promoApply.discountType,
              promoApply.discountValue,
            ),
          )
        : candidate.basePriceEgp;
      candidates.push({
        ...candidate,
        priceEgp,
        promoApply,
        promoDiscountAmountEgp: promoApply
          ? Math.max(0, candidate.basePriceEgp - priceEgp)
          : 0,
      });
    }

    const documents = await Promise.all(
      candidates.map((candidate) => input.buildDocument(candidate, session)),
    );
    await store.insert(session, documents);
    return { candidates, documents, promoFailureMessage };
  });
}
