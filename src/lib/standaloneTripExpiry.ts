import { hasPastTrip } from "./admin/waitingList.ts";
import { getCairoNowParts, type CairoNowParts } from "./time/cairoTime.ts";

const EXPIRY_MS = 2 * 60 * 60 * 1000;
const PAYMENT_SESSION_LIFETIME_MS = 30 * 60 * 1000;

export interface StandaloneTripExpiryCandidate {
  id: string;
  status: string;
  paymentStatus: string;
  date: string;
  pickupTime: string;
  createdAt: Date;
}

export interface StandalonePaymentExpiryCandidate {
  id: string;
  bookingId: string;
  overallStatus: string;
  walletStatus: string;
  gatewayStatus: string;
  walletReservationTxId: string | null;
}

export interface StandaloneTripExpiryStore {
  findPendingTripCandidates(
    cutoff: Date,
    userId?: string,
  ): Promise<StandaloneTripExpiryCandidate[]>;
  findApprovedTripCandidates(
    now: CairoNowParts,
    userId?: string,
  ): Promise<StandaloneTripExpiryCandidate[]>;
  findWaitingListTripCandidates(
    now: CairoNowParts,
    userId?: string,
  ): Promise<StandaloneTripExpiryCandidate[]>;
  expirePendingTrip(
    id: string,
    cutoff: Date,
    userId?: string,
  ): Promise<boolean>;
  expireApprovedTrip(
    id: string,
    now: CairoNowParts,
    userId?: string,
  ): Promise<boolean>;
  expireWaitingListTrip(
    id: string,
    now: CairoNowParts,
    userId?: string,
  ): Promise<boolean>;
  hasRecentActivePayment(
    tripId: string,
    since: Date,
    userId?: string,
  ): Promise<boolean>;
  findExpiredTripsWithActivePayments(userId?: string): Promise<string[]>;
  findPayments(
    tripIds: readonly string[],
    userId?: string,
  ): Promise<StandalonePaymentExpiryCandidate[]>;
  cancelActivePayment(
    id: string,
    at: Date,
    cancelGateway: boolean,
    reason: "expired" | "cancelled",
  ): Promise<StandalonePaymentExpiryCandidate | null>;
  findPayment(id: string): Promise<StandalonePaymentExpiryCandidate | null>;
  markWalletReleased(id: string): Promise<void>;
}

export async function cancelStandaloneTripPayments(input: {
  tripIds: readonly string[];
  store: StandaloneTripExpiryStore;
  releaseWalletReservation: (
    reservationTxId: string,
    opts: { description: string; paymentId: string; bookingId?: string },
  ) => Promise<boolean>;
  reservationDescription?: (bookingId: string) => string;
  reason?: "expired" | "cancelled";
  now: Date;
  userId?: string;
}): Promise<{ cancelledPayments: number; releasedWalletReservations: number }> {
  let cancelledPayments = 0;
  let releasedWalletReservations = 0;
  if (input.tripIds.length === 0) {
    return { cancelledPayments, releasedWalletReservations };
  }

  const payments = await input.store.findPayments(input.tripIds, input.userId);
  for (const candidate of payments) {
    const claimed = await input.store.cancelActivePayment(
      candidate.id,
      input.now,
      candidate.gatewayStatus === "pending",
      input.reason ?? "expired",
    );
    if (claimed) cancelledPayments += 1;
    const payment = claimed ?? (await input.store.findPayment(candidate.id));
    if (!payment || payment.overallStatus !== "cancelled") continue;
    if (payment.walletStatus !== "reserved") continue;
    if (!payment.walletReservationTxId) {
      throw new Error(
        `Cancelled payment ${payment.id} has no wallet reservation transaction`,
      );
    }

    const released = await input.releaseWalletReservation(
      payment.walletReservationTxId,
      {
        description: input.reservationDescription
          ? input.reservationDescription(payment.bookingId)
          : `Standalone trip ${payment.bookingId} expired before payment.`,
        paymentId: payment.id,
        bookingId: payment.bookingId,
      },
    );
    if (released) releasedWalletReservations += 1;
    await input.store.markWalletReleased(payment.id);
  }

  return { cancelledPayments, releasedWalletReservations };
}

export async function runStandaloneTripExpiry(input: {
  store: StandaloneTripExpiryStore;
  releaseWalletReservation: (
    reservationTxId: string,
    opts: { description: string; paymentId: string; bookingId?: string },
  ) => Promise<boolean>;
  now?: Date;
  userId?: string;
}): Promise<{
  expiredTrips: number;
  cancelledPayments: number;
  releasedWalletReservations: number;
}> {
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - EXPIRY_MS);
  const paymentCutoff = new Date(now.getTime() - PAYMENT_SESSION_LIFETIME_MS);
  const nowCairo = getCairoNowParts(now);
  const expiredTripIds = new Set<string>();
  let expiredTrips = 0;

  const pendingTrips = await input.store.findPendingTripCandidates(
    cutoff,
    input.userId,
  );
  for (const trip of pendingTrips) {
    if (
      await input.store.hasRecentActivePayment(
        trip.id,
        paymentCutoff,
        input.userId,
      )
    ) {
      continue;
    }
    if (
      await input.store.expirePendingTrip(trip.id, cutoff, input.userId)
    ) {
      expiredTripIds.add(trip.id);
      expiredTrips += 1;
    }
  }

  const approvedTrips = await input.store.findApprovedTripCandidates(
    nowCairo,
    input.userId,
  );
  for (const trip of approvedTrips) {
    if (
      await input.store.hasRecentActivePayment(
        trip.id,
        paymentCutoff,
        input.userId,
      )
    ) {
      continue;
    }
    if (
      hasPastTrip([{ date: trip.date, pickupTime: trip.pickupTime }], nowCairo) &&
      (await input.store.expireApprovedTrip(trip.id, nowCairo, input.userId))
    ) {
      expiredTripIds.add(trip.id);
      expiredTrips += 1;
    }
  }

  const waitingListTrips = await input.store.findWaitingListTripCandidates(
    nowCairo,
    input.userId,
  );
  for (const trip of waitingListTrips) {
    if (
      !hasPastTrip([{ date: trip.date, pickupTime: trip.pickupTime }], nowCairo)
    ) {
      continue;
    }
    if (
      await input.store.hasRecentActivePayment(
        trip.id,
        paymentCutoff,
        input.userId,
      )
    ) {
      continue;
    }
    if (
      await input.store.expireWaitingListTrip(trip.id, nowCairo, input.userId)
    ) {
      expiredTripIds.add(trip.id);
      expiredTrips += 1;
    }
  }

  for (const tripId of await input.store.findExpiredTripsWithActivePayments(
    input.userId,
  )) {
    expiredTripIds.add(tripId);
  }

  const paymentResults = await cancelStandaloneTripPayments({
    tripIds: [...expiredTripIds],
    store: input.store,
    releaseWalletReservation: input.releaseWalletReservation,
    reservationDescription: (bookingId) =>
      `Standalone trip ${bookingId} expired before payment.`,
    reason: "expired",
    now,
    userId: input.userId,
  });

  return { expiredTrips, ...paymentResults };
}
