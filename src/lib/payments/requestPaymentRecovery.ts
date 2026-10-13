import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { notifyAdminsOfRequestPaymentIssue } from "@/lib/notifications/adminActivity";
import { settleRequestPayment } from "@/lib/payments/requestSettlement";
import {
  recoverPaidRequestPayment,
  type RequestPaymentRecoveryIssue,
} from "@/lib/payments/requestPaymentRecoveryDecision";

const ISSUE_LABELS: Record<RequestPaymentRecoveryIssue, string> = {
  request_not_found: "Request record was not found",
  request_cancelled: "Request was cancelled",
  request_expired: "Request expired",
  request_already_paid: "Request was already paid by another payment",
  request_not_payable: "Request is not in a payable state",
  payment_not_recoverable: "Payment is in a non-recoverable state",
  late_payment_amount_mismatch:
    "Closed Payment amount differs from remaining trip total",
  wallet_reservation_released: "Wallet reservation was already released",
  amount_mismatch: "Payment amount differs from remaining trip total",
  settlement_not_applied: "Payment settlement did not apply",
};

const ACTIVE_PAYMENT_STATUSES = new Set([
  "created",
  "wallet_reserved",
  "kashier_pending",
]);

export async function handlePaidRequestPayment(input: {
  paymentId: string;
  transactionId?: string;
}) {
  if (!Types.ObjectId.isValid(input.paymentId)) {
    return "manual_review" as const;
  }
  await connectDB();

  const payment = await Payment.findById(input.paymentId)
    .select(
      "_id bookingId overallStatus totalEgp walletAmountEgp walletStatus",
    )
    .lean<{
      _id: Types.ObjectId;
      bookingId: Types.ObjectId;
      overallStatus: string;
      totalEgp: number;
      walletAmountEgp: number;
      walletStatus: string;
    } | null>();
  if (!payment) return "manual_review" as const;

  const [request, remainingTrips] = await Promise.all([
    Request.findById(payment.bookingId)
      .select("status paymentStatus")
      .lean<{ status: string; paymentStatus: string } | null>(),
    Trip.find({
      requestId: payment.bookingId,
      status: { $ne: "cancelled" },
    })
      .select("priceEgp")
      .lean<{ priceEgp: number }[]>(),
  ]);
  const expectedAmountEgp = remainingTrips.reduce(
    (total, trip) => total + trip.priceEgp,
    0,
  );

  return recoverPaidRequestPayment(
    {
      request,
      payment,
      expectedAmountEgp,
    },
    {
      settle: () =>
        settleRequestPayment(String(payment.bookingId), {
          paymentId: String(payment._id),
          transactionId: input.transactionId,
          allowClosedPayment: true,
          requireAmountMatch: !ACTIVE_PAYMENT_STATUSES.has(
            payment.overallStatus,
          ),
        }),
      async getExpectedAmountEgp() {
        const currentTrips = await Trip.find({
          requestId: payment.bookingId,
          status: { $ne: "cancelled" },
        })
          .select("priceEgp")
          .lean<{ priceEgp: number }[]>();
        return currentTrips.reduce(
          (total, trip) => total + trip.priceEgp,
          0,
        );
      },
      async recordIssue(issue) {
        const event = issue.manualReview
          ? "request_payment_manual_review"
          : "request_payment_amount_mismatch";
        const recoveryKey =
          input.transactionId ??
          `${issue.issue}:${issue.paidAmountEgp}:${issue.expectedAmountEgp}`;
        await Payment.updateOne(
          {
            _id: payment._id,
            timeline: {
              $not: {
                $elemMatch: {
                  event,
                  "meta.recoveryKey": recoveryKey,
                },
              },
            },
          },
          {
            $set: { gatewayStatus: "success" },
            $push: {
              timeline: {
                event,
                detail: `Request ${String(payment.bookingId)}; paid ${issue.paidAmountEgp} EGP; expected ${issue.expectedAmountEgp} EGP; ${ISSUE_LABELS[issue.issue]}.`,
                actor: "kashier",
                meta: {
                  requestId: String(payment.bookingId),
                  paidAmountEgp: issue.paidAmountEgp,
                  expectedAmountEgp: issue.expectedAmountEgp,
                  reason: ISSUE_LABELS[issue.issue],
                  recoveryKey,
                },
              },
            },
            ...(input.transactionId
              ? { $addToSet: { kashierTransactionIds: input.transactionId } }
              : {}),
          },
        );
        await notifyAdminsOfRequestPaymentIssue({
          paymentId: String(payment._id),
          requestId: String(payment.bookingId),
          paidAmountEgp: issue.paidAmountEgp,
          expectedAmountEgp: issue.expectedAmountEgp,
          reason: issue.issue,
        });
      },
    },
  );
}
