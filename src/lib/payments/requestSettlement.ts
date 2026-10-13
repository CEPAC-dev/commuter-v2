import "server-only";
import mongoose, { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Payment, type PaymentDoc } from "@/models/Payment";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { WalletTransaction } from "@/models/WalletTransaction";
import { captureReservation } from "@/lib/wallet/wallet";
import { buildSettlementRequestFilter } from "@/lib/pendingRequestHardening";
import { ACTIVE_PAYMENT_STATUSES } from "@/lib/payments/settlementAttempt";
import { runRequestSettlementWith } from "@/lib/payments/requestSettlementFlow";

export type RequestSettlementResult =
  | "settled"
  | "already_settled"
  | "not_settled"
  | "capture_failed";

export async function settleRequestPayment(
  requestId: string,
  options: {
    paymentId?: string;
    transactionId?: string;
    allowClosedPayment?: boolean;
    requireAmountMatch?: boolean;
  } = {},
): Promise<RequestSettlementResult> {
  if (
    !Types.ObjectId.isValid(requestId) ||
    (options.paymentId && !Types.ObjectId.isValid(options.paymentId))
  ) {
    return "not_settled";
  }

  await connectDB();
  const requestObjectId = new Types.ObjectId(requestId);
  const paymentObjectId = options.paymentId
    ? new Types.ObjectId(options.paymentId)
    : null;
  const paymentStatuses = options.allowClosedPayment
    ? [...ACTIVE_PAYMENT_STATUSES, "failed", "cancelled"]
    : ACTIVE_PAYMENT_STATUSES;
  const session = await mongoose.startSession();
  let payment: PaymentDoc | null = null;
  let requestUserId: Types.ObjectId | null = null;
  let paidAmountEgp: number | null = null;
  const settlementAmountMismatch: {
    value: { paid: number; expected: number } | null;
  } = { value: null };

  try {
    const result = await runRequestSettlementWith(
      {
        withTransaction: (work) => session.withTransaction(work),
        async isAlreadySettled() {
          const request = await Request.findById(requestObjectId)
            .session(session)
            .select("paymentStatus userId");
          requestUserId = request?.userId ?? null;
          if (!request || request.paymentStatus !== "paid") return false;
          if (!options.paymentId) return true;
          const currentPayment = await Payment.findById(options.paymentId)
            .session(session)
            .select("overallStatus");
          return currentPayment?.overallStatus === "paid";
        },
        async claimRequest() {
          settlementAmountMismatch.value = null;
          if (options.paymentId) {
            if (!paymentObjectId) return false;
            payment = await Payment.findOne({
              _id: paymentObjectId,
              bookingId: requestObjectId,
              overallStatus: { $in: paymentStatuses },
            }).session(session);
            if (!payment) return false;
            requestUserId = payment.userId;
            paidAmountEgp = payment.totalEgp;
            if (options.requireAmountMatch) {
              const remainingTrips = await Trip.find({
                requestId: requestObjectId,
                status: { $ne: "cancelled" },
              })
                .select("priceEgp")
                .session(session)
                .lean<{ priceEgp: number }[]>();
              const expectedAmountEgp = remainingTrips.reduce(
                (total, trip) => total + trip.priceEgp,
                0,
              );
              if (paidAmountEgp !== expectedAmountEgp) return false;
            }
          }

          const update = await Request.findOneAndUpdate(
            {
              ...buildSettlementRequestFilter(requestObjectId),
              status: {
                $nin: ["waiting_list", "rejected", "cancelled", "time_out"],
              },
            },
            {
              $set: {
                paymentStatus: "paid",
                status: "submitted",
                paidAt: new Date(),
              },
            },
            { returnDocument: "after", session },
          ).select("_id userId amountEgp");
          if (!update) return false;
          requestUserId = update.userId;
          if (paidAmountEgp === null) paidAmountEgp = update.amountEgp;
          return true;
        },
        async updateChildren() {
          const remainingTrips = await Trip.find({
            requestId: requestObjectId,
            status: { $ne: "cancelled" },
          })
            .select("priceEgp")
            .session(session)
            .lean<{ priceEgp: number }[]>();
          const expectedAmountEgp = remainingTrips.reduce(
            (total, trip) => total + trip.priceEgp,
            0,
          );
          if (
            paidAmountEgp !== null &&
            paidAmountEgp !== expectedAmountEgp
          ) {
            settlementAmountMismatch.value = {
              paid: paidAmountEgp,
              expected: expectedAmountEgp,
            };
          }
          await Trip.updateMany(
            {
              requestId: requestObjectId,
              status: { $ne: "cancelled" },
            },
            { $set: { paymentStatus: "paid" } },
            { session },
          );
          await Trip.updateMany(
            {
              requestId: requestObjectId,
              status: "pending_payment"
            },
            { $set: { status: "submitted" } },
            { session },
          );
        },
        ...(options.paymentId
          ? {
              async captureWallet() {
                if (!payment || !paymentObjectId) {
                  throw new Error("Request Payment was not loaded.");
                }
                if (payment.walletAmountEgp <= 0) return 0;
                if (!payment.walletReservationTxId) return null;
                return captureReservation(
                  String(payment.walletReservationTxId),
                  {
                    description: `Payment for booking ${requestId}`,
                    paymentId: String(paymentObjectId),
                    bookingId: requestId,
                    session,
                  },
                );
              },
              async finalizePayment() {
                if (!payment || !paymentObjectId) {
                  throw new Error("Request Payment was not loaded.");
                }
                const paymentUpdate = await Payment.updateOne(
                  {
                    _id: paymentObjectId,
                    overallStatus: { $in: paymentStatuses },
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
                        event: "request_paid",
                        ...(options.transactionId
                          ? { detail: options.transactionId }
                          : {}),
                      },
                    },
                  },
                  { session },
                );
                if (paymentUpdate.matchedCount !== 1) {
                  throw new Error(
                    "Payment attempt changed during Request settlement.",
                  );
                }

                if (payment.gatewayAmountEgp > 0) {
                  await WalletTransaction.updateOne(
                    { paymentId: paymentObjectId, type: "kashier_payment" },
                    {
                      $setOnInsert: {
                        userId: payment.userId,
                        type: "kashier_payment",
                        amountEgp: payment.gatewayAmountEgp,
                        status: "completed",
                        description: `Card payment via Kashier for booking ${requestId}`,
                        paymentId: paymentObjectId,
                        bookingId: requestObjectId,
                        kashierSessionId: payment.kashierSessionId ?? undefined,
                        kashierOrderId: payment.kashierOrderId ?? undefined,
                      },
                      ...(options.transactionId
                        ? { $addToSet: { kashierTransactionIds: options.transactionId } }
                        : {}),
                    },
                    { upsert: true, session },
                  );
                }
              },
            }
          : {}),
        ...(options.transactionId
          ? {
              async recordWebhookEvent() {
                await Request.updateOne(
                  { _id: requestObjectId },
                  { $addToSet: { kashierTransactionIds: options.transactionId } },
                  { session },
                );
                if (options.paymentId) {
                  await Payment.updateOne(
                    { _id: paymentObjectId },
                    { $addToSet: { kashierTransactionIds: options.transactionId } },
                    { session },
                  );
                }
              },
            }
          : {}),
      },
      options.transactionId,
    );

    const amountMismatch = settlementAmountMismatch.value;
    if (result === "settled" && amountMismatch) {
      console.info(
        JSON.stringify({
          tag: "[multiday]",
          event: "settlement_amount_mismatch",
          requestId,
          paid: amountMismatch.paid,
          expected: amountMismatch.expected,
        }),
      );
    }

    if (result === "settled" && requestUserId) {
      const { createNotification } = await import(
        "@/lib/notifications/createNotification"
      );
      try {
        await createNotification({
          userId: String(requestUserId),
          type: "payment_paid",
          title: "Payment completed",
          body: "Your booking payment was successful.",
          data: {
            bookingId: requestId,
            ...(options.paymentId ? { paymentId: options.paymentId } : {}),
          },
        });
      } catch (error) {
        console.error(
          `[Payment] Request settlement notification failed for ${requestId}:`,
          error,
        );
      }
    }
    return result;
  } finally {
    await session.endSession();
  }
}
