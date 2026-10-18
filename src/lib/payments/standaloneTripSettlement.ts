import mongoose from "mongoose";
import { Payment } from "@/models/Payment";
import { Trip } from "@/models/Trip";
import { WalletTransaction } from "@/models/WalletTransaction";
import { captureReservation, releaseReservation } from "@/lib/wallet/wallet";
import {
  ACTIVE_PAYMENT_STATUSES,
  isInFlightPaymentStatus,
  runStandaloneSettlementSteps,
  runStandalonePaymentFailure,
} from "@/lib/payments/settlementAttempt";

type SettlementResult = "settled" | "already_paid" | "blocked" | "missing" | "capture_failed";
type FailureResult = "failed" | "ignored" | "missing";

class ReservationCaptureFailed extends Error {}
export async function settleStandaloneTripPayment(
  tripId: string,
  paymentId: string,
  transactionId?: string,
): Promise<SettlementResult> {
  const session = await mongoose.startSession();
  let result: SettlementResult = "missing";

  try {
    try {
      await session.withTransaction(async () => {
        result = "missing";
        const payment = await Payment.findOne({
          _id: paymentId,
          bookingId: tripId,
          overallStatus: { $in: ACTIVE_PAYMENT_STATUSES },
        }).session(session);

        if (!payment) {
          const current = await Payment.findById(paymentId)
            .session(session)
            .select("overallStatus");
          result = current?.overallStatus === "paid" ? "already_paid" : "missing";
          return;
        }

        const trip = await Trip.findOne({ _id: tripId, requestId: null }).session(
          session,
        );
        if (!trip) return;

        if (trip.paymentStatus === "paid") {
          const sameAttempt =
            String(trip.settlementPaymentId ?? "") === String(payment._id) ||
            (!trip.settlementPaymentId &&
              ((payment.kashierOrderId &&
                payment.kashierOrderId === trip.kashierOrderId) ||
                (payment.kashierSessionId &&
                  payment.kashierSessionId === trip.kashierSessionId) ||
                (payment.createdAt &&
                  trip.paidAt &&
                  payment.createdAt <= trip.paidAt)));
          if (trip.status !== "submitted" || !sameAttempt) {
            result = "blocked";
            return;
          }
        } else {
          const claimed = await Trip.findOneAndUpdate(
            {
              _id: tripId,
              requestId: null,
              paymentStatus: { $in: ["pending", "failed"] },
              status: { $in: ["pending_payment", "approved"] },
            },
            {
              $set: {
                paymentStatus: "paid",
                status: "submitted",
                paidAt: new Date(),
                settlementPaymentId: payment._id,
                ...(payment.kashierSessionId
                  ? { kashierSessionId: payment.kashierSessionId }
                  : {}),
                ...(payment.kashierOrderId
                  ? { kashierOrderId: payment.kashierOrderId }
                  : {}),
              },
              ...(transactionId
                ? { $addToSet: { kashierTransactionIds: transactionId } }
                : {}),
            },
            { returnDocument: "after", session },
          );
          if (!claimed) {
            result = ["cancelled", "time_out", "rejected"].includes(trip.status)
              ? "blocked"
              : "missing";
            return;
          }
        }

        await runStandaloneSettlementSteps({
          captureWallet: async () => {
            if (!payment.walletReservationTxId || payment.walletAmountEgp <= 0)
              return;
            const captured = await captureReservation(
              String(payment.walletReservationTxId),
              {
                description: `Payment for trip ${tripId}`,
                paymentId: String(payment._id),
                bookingId: String(tripId),
                session,
              },
            );
            if (captured === null) throw new ReservationCaptureFailed();
          },
          markPaymentPaid: async () => {
            const paymentUpdate = await Payment.updateOne(
              {
                _id: payment._id,
                overallStatus: { $in: ACTIVE_PAYMENT_STATUSES },
              },
              {
                $set: {
                  gatewayStatus:
                    payment.gatewayAmountEgp > 0
                      ? "success"
                      : payment.gatewayStatus,
                  walletStatus:
                    payment.walletAmountEgp > 0
                      ? "captured"
                      : payment.walletStatus,
                  overallStatus: "paid",
                  paidAt: new Date(),
                },
                $push: {
                  timeline: {
                    event: "trip_paid",
                    ...(transactionId ? { detail: transactionId } : {}),
                  },
                },
              },
              { session },
            );
            if (paymentUpdate.matchedCount !== 1) {
              throw new Error("Payment attempt changed during Trip settlement.");
            }
          },
          writeGatewayLedger: async () => {
            if (payment.gatewayAmountEgp <= 0) return;
            await WalletTransaction.updateOne(
              {
                paymentId: payment._id,
                tripId: trip._id,
                type: "kashier_payment",
              },
              {
                $setOnInsert: {
                  userId: payment.userId,
                  type: "kashier_payment",
                  amountEgp: payment.gatewayAmountEgp,
                  status: "completed",
                  description: `Card payment for trip ${tripId}`,
                  paymentId: payment._id,
                  bookingId: trip._id,
                  tripId: trip._id,
                  kashierSessionId: payment.kashierSessionId ?? undefined,
                  kashierOrderId: payment.kashierOrderId ?? undefined,
                },
                ...(transactionId
                  ? { $addToSet: { kashierTransactionIds: transactionId } }
                  : {}),
              },
              { upsert: true, session },
            );
          },
        });

        result = "settled";
      });
    } catch (error) {
      if (error instanceof ReservationCaptureFailed) return "capture_failed";
      throw error;
    }
    return result;
  } finally {
    await session.endSession();
  }
}

export async function failStandaloneTripPayment(
  tripId: string,
  paymentId: string,
  outcome: string,
): Promise<FailureResult> {
  const session = await mongoose.startSession();
  let result: FailureResult = "missing";
  let warnDetail: string | null = null;

  try {
    await session.withTransaction(async () => {
        result = "missing";
        warnDetail = null;
        const payment = await Payment.findOne({
          _id: paymentId,
          bookingId: tripId,
        }).session(session);
        if (!payment) return;

        const trip = await Trip.findOne({ _id: tripId, requestId: null })
          .session(session)
          .select("paymentStatus status");
        if (!trip) return;

      result = await runStandalonePaymentFailure({
        paymentInFlight: isInFlightPaymentStatus(payment.overallStatus),
        tripStatus: trip.status,
        tripPaymentStatus: trip.paymentStatus,
        markPaymentFailed: async () => {
          const failedPayment = await Payment.findOneAndUpdate(
            {
              _id: payment._id,
              overallStatus: { $in: ACTIVE_PAYMENT_STATUSES },
            },
            {
              $set: {
                gatewayStatus: "failed",
                walletStatus:
                  payment.walletAmountEgp > 0
                    ? "released"
                    : payment.walletStatus,
                overallStatus: "failed",
              },
              $push: {
                timeline: {
                  event: "kashier_failed",
                  detail: outcome,
                  meta: { paymentId, outcome },
                },
              },
            },
            { returnDocument: "after", session },
          );
          return Boolean(failedPayment);
        },
        releaseWallet: async () => {
          if (
            !payment.walletReservationTxId ||
            payment.walletStatus !== "reserved"
          )
            return;
          const released = await releaseReservation(
            String(payment.walletReservationTxId),
            {
              description: `Released — Kashier failure for trip ${tripId}`,
              paymentId,
              bookingId: tripId,
              session,
            },
          );
          if (!released) {
            throw new Error(
              `Could not release wallet reservation for failed Payment ${paymentId}.`,
            );
          }
        },
        hasOtherInFlightPayment: async () =>
          Boolean(
            await Payment.exists({
              bookingId: tripId,
              _id: { $ne: payment._id },
              overallStatus: { $in: ACTIVE_PAYMENT_STATUSES },
            }).session(session),
          ),
        markTripFailed: async () => {
          await Trip.updateOne(
            {
              _id: tripId,
              requestId: null,
              paymentStatus: { $in: ["pending", "failed"] },
              status: { $in: ["pending_payment", "approved"] },
            },
            {
              $set: { paymentStatus: "failed" },
              ...(outcome
                ? { $addToSet: { kashierTransactionIds: outcome } }
                : {}),
            },
            { session },
          );
        },
        recordIgnored: async () => {
          warnDetail = `Ignored failure for Payment ${paymentId} (${outcome}) while Trip was ${trip.paymentStatus}/${trip.status} and payment status was ${payment.overallStatus}.`;
          await Payment.updateOne(
            { _id: payment._id },
            {
              $push: {
                timeline: {
                  event: "late_kashier_failure_ignored",
                  detail: outcome,
                  meta: { paymentId, outcome },
                },
              },
            },
            { session },
          );
        },
      });
    });
    if (warnDetail) console.warn(`[Payment] ${warnDetail}`);
    return result;
  } finally {
    await session.endSession();
  }
}
