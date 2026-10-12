import mongoose, { Types, type ClientSession } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { releasePromoForRequest } from "@/lib/promoCode";
import { verifyAndSettleBooking } from "@/lib/payments/kashier";
import { verifyExpiredRequestPayments as verifyExpiredRequestPaymentList } from "@/lib/payments/sessionTiming";
import {
  cancelRequestDayWith,
  cancelWholeRequestWith,
  RequestGroupCancellationError,
  type RequestGroupCancellationStore,
} from "./requestGroupCancellationCore.ts";

export {
  cancelRequestDayWith,
  cancelWholeRequestWith,
  RequestGroupCancellationError,
} from "./requestGroupCancellationCore.ts";

const ACTIVE_PAYMENT_STATUSES = [
  "created",
  "wallet_reserved",
  "kashier_pending",
];

async function verifyExpiredPayments(requestId: string, userId: string) {
  const activePayments = await Payment.find({
    bookingId: new Types.ObjectId(requestId),
    overallStatus: { $in: ACTIVE_PAYMENT_STATUSES },
  })
    .select("_id createdAt")
    .lean<{ _id: Types.ObjectId; createdAt: Date }[]>();

  await verifyExpiredRequestPaymentList(
    activePayments.map((payment) => ({
      id: String(payment._id),
      createdAt: payment.createdAt,
    })),
    new Date(),
    (paymentId) =>
      verifyAndSettleBooking(requestId, userId, paymentId),
  );
}

function createMongooseStore(): RequestGroupCancellationStore<ClientSession> {
  return {
    async withTransaction<TResult>(
      work: (session: ClientSession) => Promise<TResult>,
    ): Promise<TResult> {
      const session = await mongoose.startSession();
      try {
        let result!: TResult;
        await session.withTransaction(async () => {
          result = await work(session);
        });
        return result;
      } finally {
        await session.endSession();
      }
    },
    async getRequest(session, requestId, userId) {
      const record = await Request.findOne({
        _id: new Types.ObjectId(requestId),
        userId: new Types.ObjectId(userId),
      })
        .select("_id userId status paymentStatus amountEgp kashierSessionId tripIds")
        .session(session)
        .lean<{
          _id: Types.ObjectId;
          userId: Types.ObjectId;
          status: string;
          paymentStatus: string;
          amountEgp: number;
          kashierSessionId?: string;
          tripIds: Types.ObjectId[];
        } | null>();
      if (!record) return null;
      return {
        id: String(record._id),
        userId: String(record.userId),
        status: record.status,
        paymentStatus: record.paymentStatus,
        amountEgp: record.amountEgp,
        kashierSessionId: record.kashierSessionId ?? null,
        tripIds: record.tripIds.map(String),
      };
    },
    async findTrips(session, requestId) {
      const records = await Trip.find({
        requestId: new Types.ObjectId(requestId),
      })
        .select("_id status paymentStatus priceEgp date")
        .session(session)
        .lean<
          {
            _id: Types.ObjectId;
            status: string;
            paymentStatus: string;
            priceEgp: number;
            date: string;
          }[]
        >();
      return records.map((trip) => ({
        id: String(trip._id),
        status: trip.status,
        paymentStatus: trip.paymentStatus,
        priceEgp: trip.priceEgp,
        date: trip.date,
      }));
    },
    async hasActivePayment(session, requestId) {
      return Boolean(
        await Payment.exists({
          bookingId: new Types.ObjectId(requestId),
          overallStatus: { $in: ACTIVE_PAYMENT_STATUSES },
        }).session(session),
      );
    },
    async cancelTrip(session, requestId, tripId, reason, now) {
      const result = await Trip.updateOne(
        {
          _id: new Types.ObjectId(tripId),
          requestId: new Types.ObjectId(requestId),
          status: { $ne: "cancelled" },
          paymentStatus: { $ne: "paid" },
        },
        {
          $set: {
            status: "cancelled",
            cancelledBy: "passenger",
            cancelReason: reason,
            cancellation: {
              cancelledAt: now,
              tierLabel: "pre_payment",
              refundPercent: 0,
              penaltyPercent: 0,
              refundAmount: 0,
              retainedAmount: 0,
              refundStatus: "none",
              reason,
            },
            updatedAt: now,
          },
        },
        { session },
      );
      return result.modifiedCount === 1;
    },
    async cancelRemainingTrips(session, requestId, reason, now) {
      const result = await Trip.updateMany(
        {
          requestId: new Types.ObjectId(requestId),
          status: { $ne: "cancelled" },
          paymentStatus: { $ne: "paid" },
        },
        {
          $set: {
            status: "cancelled",
            cancelledBy: "passenger",
            cancelReason: reason,
            cancellation: {
              cancelledAt: now,
              tierLabel: "pre_payment",
              refundPercent: 0,
              penaltyPercent: 0,
              refundAmount: 0,
              retainedAmount: 0,
              refundStatus: "none",
              reason,
            },
            updatedAt: now,
          },
        },
        { session },
      );
      return result.modifiedCount;
    },
    async updateRequest(session, requestId, userId, expected, update) {
      const result = await Request.updateOne(
        {
          _id: new Types.ObjectId(requestId),
          userId: new Types.ObjectId(userId),
          status: expected.status,
          paymentStatus: expected.paymentStatus,
          amountEgp: expected.amountEgp,
        },
        { $set: { ...update, updatedAt: new Date() } },
        { session },
      );
      return result.modifiedCount === 1;
    },
    releasePromos: (session, requestId) =>
      releasePromoForRequest(requestId, { session }),
  };
}

async function getMongooseStore(input: {
  requestId: string;
  userId: string;
}) {
  if (
    !Types.ObjectId.isValid(input.requestId) ||
    !Types.ObjectId.isValid(input.userId)
  ) {
    throw new RequestGroupCancellationError(
      "REQUEST_NOT_FOUND",
      "Request not found.",
    );
  }
  await connectDB();
  return createMongooseStore();
}

export async function cancelRequestDay(input: {
  requestId: string;
  tripId: string;
  userId: string;
  reason?: string;
}) {
  const store = await getMongooseStore(input);
  await verifyExpiredPayments(input.requestId, input.userId);
  return cancelRequestDayWith(store, input);
}

export async function cancelWholeRequest(input: {
  requestId: string;
  userId: string;
  reason?: string;
}) {
  const store = await getMongooseStore(input);
  await verifyExpiredPayments(input.requestId, input.userId);
  return cancelWholeRequestWith(store, input);
}
