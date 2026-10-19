import mongoose, { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import {
  cancelStandaloneTripPayments as cancelStandaloneTripPaymentsWith,
  runStandaloneTripExpiry,
  type StandalonePaymentExpiryCandidate,
  type StandaloneTripExpiryCandidate,
  type StandaloneTripExpiryStore,
} from "@/lib/standaloneTripExpiry";
import { buildUnlinkedTripExpiryFilter } from "@/lib/pendingRequestHardening";
import { Payment } from "@/models/Payment";
import { Trip } from "@/models/Trip";
import { releaseReservation } from "@/lib/wallet/wallet";
import { releasePromoCodeUsageForTrip } from "@/lib/promoCode";

const UNPAID_STATUSES = ["pending", "failed"] as const;
const ACTIVE_PAYMENT_STATUSES = [
  "created",
  "wallet_reserved",
  "kashier_pending",
] as const;
const RECENT_PAYMENT_MS = 30 * 60 * 1000;

class RecentPaymentFound extends Error {}

async function expireTripInTransaction(input: {
  session: mongoose.ClientSession;
  filter: Record<string, unknown>;
  tripId: string;
  userId?: string;
}): Promise<boolean> {
  const updated = await Trip.updateOne(
    input.filter,
    { $set: { status: "time_out", paymentStatus: "expired" } },
    { session: input.session },
  );
  if (updated.modifiedCount !== 1) return false;

  const recentPayment = await Payment.exists({
    bookingId: new Types.ObjectId(input.tripId),
    overallStatus: { $in: ACTIVE_PAYMENT_STATUSES },
    $or: [
      { createdAt: { $gte: new Date(Date.now() - RECENT_PAYMENT_MS) } },
      { updatedAt: { $gte: new Date(Date.now() - RECENT_PAYMENT_MS) } },
    ],
    ...userFilter(input.userId),
  }).session(input.session);
  if (recentPayment) throw new RecentPaymentFound();

  await releasePromoCodeUsageForTrip(input.tripId, input.session);
  return true;
}

interface TripCandidateDocument {
  _id: Types.ObjectId;
  status: string;
  paymentStatus: string;
  date: string;
  pickupTime: string;
  createdAt: Date;
}

interface PaymentCandidateDocument {
  _id: Types.ObjectId;
  bookingId: Types.ObjectId;
  overallStatus: string;
  walletStatus: string;
  gatewayStatus: string;
  walletReservationTxId?: Types.ObjectId | null;
}

function mapTripCandidate(
  trip: TripCandidateDocument,
): StandaloneTripExpiryCandidate {
  return {
    id: String(trip._id),
    status: trip.status,
    paymentStatus: trip.paymentStatus,
    date: trip.date,
    pickupTime: trip.pickupTime,
    createdAt: trip.createdAt,
  };
}

function mapPaymentCandidate(
  payment: PaymentCandidateDocument,
): StandalonePaymentExpiryCandidate {
  return {
    id: String(payment._id),
    bookingId: String(payment.bookingId),
    overallStatus: payment.overallStatus,
    walletStatus: payment.walletStatus,
    gatewayStatus: payment.gatewayStatus,
    walletReservationTxId: payment.walletReservationTxId
      ? String(payment.walletReservationTxId)
      : null,
  };
}

function userFilter(userId?: string) {
  return userId ? { userId: new Types.ObjectId(userId) } : {};
}

function activeOrReservedPaymentFilter() {
  return {
    $or: [
      { overallStatus: { $in: ACTIVE_PAYMENT_STATUSES } },
      { overallStatus: "cancelled", walletStatus: "reserved" },
    ],
  };
}

const mongoExpiryStore: StandaloneTripExpiryStore = {
  async findPendingTripCandidates(cutoff, userId) {
    const trips = await Trip.find(buildUnlinkedTripExpiryFilter("pending_payment", {
      requestId: null,
      paymentStatus: { $in: UNPAID_STATUSES },
      createdAt: { $lte: cutoff },
      ...userFilter(userId),
    }))
      .select("_id status paymentStatus date pickupTime createdAt")
      .lean<TripCandidateDocument[]>();
    return trips.map(mapTripCandidate);
  },

  async findApprovedTripCandidates(now, userId) {
    const trips = await Trip.find(buildUnlinkedTripExpiryFilter("approved", {
      requestId: null,
      paymentStatus: { $in: UNPAID_STATUSES },
      $or: [
        { date: { $lt: now.dateStr } },
        { date: now.dateStr, pickupTime: { $lt: now.timeStr } },
      ],
      ...userFilter(userId),
    }))
      .select("_id status paymentStatus date pickupTime createdAt")
      .lean<TripCandidateDocument[]>();
    return trips.map(mapTripCandidate);
  },

  async findWaitingListTripCandidates(now, userId) {
    const trips = await Trip.find(buildUnlinkedTripExpiryFilter("waiting_list", {
      requestId: null,
      $or: [
        { date: { $lt: now.dateStr } },
        { date: now.dateStr, pickupTime: { $lt: now.timeStr } },
      ],
      ...userFilter(userId),
    }))
      .select("_id status paymentStatus date pickupTime createdAt")
      .lean<TripCandidateDocument[]>();
    return trips.map(mapTripCandidate);
  },

  async expirePendingTrip(id, cutoff, userId) {
    const session = await mongoose.startSession();
    try {
      let expired = false;
      try {
        await session.withTransaction(async () => {
          expired = false;
          expired = await expireTripInTransaction({
            session,
            tripId: id,
            userId,
            filter: buildUnlinkedTripExpiryFilter("pending_payment", {
              _id: new Types.ObjectId(id),
              requestId: null,
              paymentStatus: { $in: UNPAID_STATUSES },
              createdAt: { $lte: cutoff },
              ...userFilter(userId),
            }),
          });
        });
      } catch (error) {
        if (!(error instanceof RecentPaymentFound)) throw error;
      }
      return expired;
    } finally {
      await session.endSession();
    }
  },

  async expireApprovedTrip(id, now, userId) {
    const session = await mongoose.startSession();
    try {
      let expired = false;
      try {
        await session.withTransaction(async () => {
          expired = false;
          expired = await expireTripInTransaction({
            session,
            tripId: id,
            userId,
            filter: buildUnlinkedTripExpiryFilter("approved", {
              _id: new Types.ObjectId(id),
              requestId: null,
              paymentStatus: { $in: UNPAID_STATUSES },
              $or: [
                { date: { $lt: now.dateStr } },
                { date: now.dateStr, pickupTime: { $lt: now.timeStr } },
              ],
              ...userFilter(userId),
            }),
          });
        });
      } catch (error) {
        if (!(error instanceof RecentPaymentFound)) throw error;
      }
      return expired;
    } finally {
      await session.endSession();
    }
  },

  async expireWaitingListTrip(id, now, userId) {
    const session = await mongoose.startSession();
    try {
      let expired = false;
      try {
        await session.withTransaction(async () => {
          expired = false;
          expired = await expireTripInTransaction({
            session,
            tripId: id,
            userId,
            filter: buildUnlinkedTripExpiryFilter("waiting_list", {
              _id: new Types.ObjectId(id),
              requestId: null,
              $or: [
                { date: { $lt: now.dateStr } },
                { date: now.dateStr, pickupTime: { $lt: now.timeStr } },
              ],
              ...userFilter(userId),
            }),
          });
        });
      } catch (error) {
        if (!(error instanceof RecentPaymentFound)) throw error;
      }
      return expired;
    } finally {
      await session.endSession();
    }
  },

  async hasRecentActivePayment(tripId, since, userId) {
    const payment = await Payment.exists({
      bookingId: new Types.ObjectId(tripId),
      overallStatus: { $in: ACTIVE_PAYMENT_STATUSES },
      $or: [{ createdAt: { $gte: since } }, { updatedAt: { $gte: since } }],
      ...userFilter(userId),
    });
    return payment !== null;
  },

  async findExpiredTripsWithActivePayments(userId) {
    const payments = await Payment.find({
      ...activeOrReservedPaymentFilter(),
      ...userFilter(userId),
    })
      .select("bookingId")
      .lean<{ bookingId: Types.ObjectId }[]>();
    const bookingIds = Array.from(
      new Map(
        payments.map((payment) => [String(payment.bookingId), payment.bookingId]),
      ).values(),
    );
    if (bookingIds.length === 0) return [];

    const trips = await Trip.find(buildUnlinkedTripExpiryFilter("time_out", {
      _id: { $in: bookingIds },
      requestId: null,
      paymentStatus: "expired",
      ...userFilter(userId),
    }))
      .select("_id")
      .lean<{ _id: Types.ObjectId }[]>();
    return trips.map((trip) => String(trip._id));
  },

  async findPayments(tripIds, userId) {
    const payments = await Payment.find({
      bookingId: { $in: tripIds.map((id) => new Types.ObjectId(id)) },
      ...activeOrReservedPaymentFilter(),
      ...userFilter(userId),
    })
      .select(
        "_id bookingId overallStatus walletStatus gatewayStatus walletReservationTxId",
      )
      .lean<PaymentCandidateDocument[]>();
    return payments.map(mapPaymentCandidate);
  },

  async cancelActivePayment(id, at, cancelGateway, reason) {
    const set: Record<string, string> = { overallStatus: "cancelled" };
    if (cancelGateway) set.gatewayStatus = "cancelled";
    const expired = reason === "expired";
    const payment = await Payment.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        overallStatus: { $in: ACTIVE_PAYMENT_STATUSES },
      },
      {
        $set: set,
        $push: {
          timeline: {
            at,
            event: expired ? "trip_expired" : "trip_cancelled",
            detail: expired
              ? "Standalone trip expired before payment completed."
              : "Standalone trip cancelled before payment completed.",
            actor: "system",
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean<PaymentCandidateDocument | null>();
    return payment ? mapPaymentCandidate(payment) : null;
  },

  async findPayment(id) {
    const payment = await Payment.findById(id)
      .select(
        "_id bookingId overallStatus walletStatus gatewayStatus walletReservationTxId",
      )
      .lean<PaymentCandidateDocument | null>();
    return payment ? mapPaymentCandidate(payment) : null;
  },

  async markWalletReleased(id) {
    await Payment.updateOne(
      {
        _id: new Types.ObjectId(id),
        overallStatus: "cancelled",
        walletStatus: "reserved",
      },
      { $set: { walletStatus: "released" } },
    );
  },
};

export async function expireStandaloneTrips(
  userId?: string,
  now: Date = new Date(),
): Promise<{
  expiredTrips: number;
  cancelledPayments: number;
  releasedWalletReservations: number;
}> {
  await connectDB();
  return runStandaloneTripExpiry({
    store: mongoExpiryStore,
    releaseWalletReservation: releaseReservation,
    now,
    userId,
  });
}

export async function cancelStandaloneTripPayments(
  tripId: string,
  now: Date = new Date(),
): Promise<{ cancelledPayments: number; releasedWalletReservations: number }> {
  await connectDB();
  return cancelStandaloneTripPaymentsWith({
    tripIds: [tripId],
    store: mongoExpiryStore,
    releaseWalletReservation: releaseReservation,
    reservationDescription: (bookingId) =>
      `Standalone trip ${bookingId} cancelled before payment.`,
    reason: "cancelled",
    now,
  });
}
