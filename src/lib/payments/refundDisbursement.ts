import mongoose, { Types } from "mongoose";
import { Wallet } from "@/models/Wallet";
import { WalletTransaction } from "@/models/WalletTransaction";
import { Trip } from "@/models/Trip";
import {
  refundKashierPayment,
  resolveKashierRefundOrderId,
} from "@/lib/payments/kashier";
import { planRefundSplit } from "@/lib/payments/refundMath";

export type RefundablePayment = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  bookingId: Types.ObjectId;
  walletStatus: string;
  walletAmountEgp: number;
  gatewayAmountEgp: number;
  kashierSessionId?: string | null;
  kashierOrderId?: string | null;
  kashierRefundIds?: string[];
};

export type RefundDisbursementResult = {
  walletCapturedEgp: number;
  walletAlreadyRefundedEgp: number;
  gatewayAlreadyRefundedEgp: number;
  walletRefundEgp: number;
  gatewayRefundEgp: number;
  confirmedGatewayRefundEgp: number;
  walletRefundTxId: Types.ObjectId | null;
  kashierRefundId: string | null;
  attemptedKashierRefundId: string | null;
  gatewayRefundFailed: boolean;
  gatewayRefundPending: boolean;
  gatewayRefundDuplicate: boolean;
  gatewayRefundRetrySafe: boolean;
  timelineEvents: { event: string; detail?: string }[];
};

async function creditRefundWalletOnce(input: {
  operationId: string;
  userId: Types.ObjectId;
  bookingId: Types.ObjectId;
  paymentId?: Types.ObjectId;
  tripId: string;
  amountEgp: number;
  reason?: string;
}): Promise<{ transactionId: Types.ObjectId; amountEgp: number }> {
  const existing = await WalletTransaction.findOne({
    refundOperationId: input.operationId,
    type: "refund",
    status: "completed",
  })
    .select("_id amountEgp")
    .lean<{ _id: Types.ObjectId; amountEgp: number } | null>();
  if (existing) {
    if (existing.amountEgp !== input.amountEgp) {
      throw new Error(
        "Refund operation already exists with a different amount.",
      );
    }
    return { transactionId: existing._id, amountEgp: existing.amountEgp };
  }

  const session = await mongoose.startSession();
  let result: { transactionId: Types.ObjectId; amountEgp: number } | null =
    null;
  try {
    await session.withTransaction(async () => {
      const duplicate = await WalletTransaction.findOne({
        refundOperationId: input.operationId,
        type: "refund",
        status: "completed",
      })
        .select("_id amountEgp")
        .session(session)
        .lean<{ _id: Types.ObjectId; amountEgp: number } | null>();
      if (duplicate) {
        if (duplicate.amountEgp !== input.amountEgp) {
          throw new Error(
            "Refund operation already exists with a different amount.",
          );
        }
        result = {
          transactionId: duplicate._id,
          amountEgp: duplicate.amountEgp,
        };
        return;
      }

      const wallet = await Wallet.findOneAndUpdate(
        { userId: input.userId },
        {
          $inc: {
            balanceEgp: input.amountEgp,
            totalCreditedEgp: input.amountEgp,
          },
          $set: { lastTransactionAt: new Date() },
        },
        { returnDocument: "after", upsert: true, session, runValidators: true },
      );
      const [transaction] = await WalletTransaction.create(
        [
          {
            userId: input.userId,
            type: "refund",
            amountEgp: input.amountEgp,
            status: "completed",
            description: `Refund for booking ${input.bookingId}${input.reason ? ` — ${input.reason}` : ""}`,
            balanceAfterEgp: wallet.balanceEgp,
            bookingId: input.bookingId,
            ...(input.paymentId ? { paymentId: input.paymentId } : {}),
            tripId: new Types.ObjectId(input.tripId),
            refundOperationId: input.operationId,
          },
        ],
        { session },
      );
      result = { transactionId: transaction._id, amountEgp: input.amountEgp };
    });
  } catch (error) {
    const retried = await WalletTransaction.findOne({
      refundOperationId: input.operationId,
      type: "refund",
      status: "completed",
    })
      .select("_id amountEgp")
      .lean<{ _id: Types.ObjectId; amountEgp: number } | null>();
    if (retried && retried.amountEgp === input.amountEgp) {
      return { transactionId: retried._id, amountEgp: retried.amountEgp };
    }
    throw error;
  } finally {
    await session.endSession();
  }
  if (!result) throw new Error("Wallet refund was not recorded.");
  return result;
}

export async function disburseTripRefund(input: {
  operationId: string;
  payment: RefundablePayment;
  tripId: string;
  amountEgp: number;
  reason?: string;
}): Promise<RefundDisbursementResult> {
  if (!Number.isSafeInteger(input.amountEgp) || input.amountEgp < 0) {
    throw new RangeError(
      "Refund amount must be a non-negative whole EGP value.",
    );
  }

  const existingWalletRefund = await WalletTransaction.findOne({
    refundOperationId: input.operationId,
    type: "refund",
    status: "completed",
  })
    .select("_id amountEgp")
    .lean<{ _id: Types.ObjectId; amountEgp: number } | null>();
  const walletRefunds = await WalletTransaction.aggregate<{
    amountEgp: number;
  }>([
    {
      $match: {
        paymentId: input.payment._id,
        type: "refund",
        status: "completed",
      },
    },
    { $group: { _id: null, amountEgp: { $sum: "$amountEgp" } } },
  ]);
  const walletCapturedEgp =
    input.payment.walletStatus === "captured"
      ? input.payment.walletAmountEgp
      : 0;
  const walletAlreadyRefundedEgp = Math.min(
    walletCapturedEgp,
    walletRefunds[0]?.amountEgp ?? 0,
  );
  const split = planRefundSplit(
    input.amountEgp,
    walletCapturedEgp,
    walletAlreadyRefundedEgp,
  );
  const walletRefundEgp =
    existingWalletRefund?.amountEgp ?? split.walletRefundEgp;
  const gatewayRefundEgp = input.amountEgp - walletRefundEgp;
  const completedGatewayRefunds = await WalletTransaction.find({
    paymentId: input.payment._id,
    type: "payment_refund_partial",
    status: "completed",
  })
    .select("amountEgp")
    .lean<{ amountEgp: number }[]>();
  const gatewayAlreadyRefundedEgp = completedGatewayRefunds.reduce(
    (total, entry) => total + entry.amountEgp,
    0,
  );
  let walletRefundTxId: Types.ObjectId | null =
    existingWalletRefund?._id ?? null;
  if (walletRefundEgp > 0 && !walletRefundTxId) {
    const walletRefund = await creditRefundWalletOnce({
      operationId: input.operationId,
      userId: input.payment.userId,
      bookingId: input.payment.bookingId,
      paymentId: input.payment._id,
      tripId: input.tripId,
      amountEgp: walletRefundEgp,
      reason: input.reason,
    });
    walletRefundTxId = walletRefund.transactionId;
  }

  const timelineEvents: RefundDisbursementResult["timelineEvents"] = [
    { event: "refund_requested", detail: `${input.amountEgp} EGP` },
  ];
  const existingGatewayRefund = await WalletTransaction.findOne({
    refundOperationId: input.operationId,
    type: "payment_refund_partial",
    status: "completed",
  })
    .select("_id amountEgp kashierRefundId")
    .lean<{
      _id: Types.ObjectId;
      amountEgp: number;
      kashierRefundId?: string;
    } | null>();
  if (existingGatewayRefund) {
    if (existingGatewayRefund.amountEgp !== gatewayRefundEgp) {
      throw new Error(
        "Gateway refund operation already exists with a different amount.",
      );
    }
    return {
      walletCapturedEgp,
      walletAlreadyRefundedEgp,
      gatewayAlreadyRefundedEgp,
      walletRefundEgp,
      gatewayRefundEgp,
      confirmedGatewayRefundEgp: gatewayRefundEgp,
      walletRefundTxId,
      kashierRefundId: existingGatewayRefund.kashierRefundId ?? null,
      attemptedKashierRefundId: existingGatewayRefund.kashierRefundId ?? null,
      gatewayRefundFailed: false,
      gatewayRefundPending: false,
      gatewayRefundDuplicate: false,
      gatewayRefundRetrySafe: false,
      timelineEvents: [
        ...timelineEvents,
        { event: "kashier_refund_previously_recorded" },
      ],
    };
  }

  let kashierRefundId: string | null = null;
  let attemptedKashierRefundId: string | null = null;
  let gatewayRefundFailed = false;
  let gatewayRefundPending = false;
  let gatewayRefundDuplicate = false;
  let gatewayRefundRetrySafe = false;
  const previouslyRecordedRefundIds = new Set(
    input.payment.kashierRefundIds ?? [],
  );
  if (gatewayRefundEgp > 0) {
    await Trip.updateOne(
      {
        _id: new Types.ObjectId(input.tripId),
        "adminRefund.refundOperationId": input.operationId,
      },
      { $set: { "adminRefund.gatewayRefundAmountEgp": gatewayRefundEgp } },
    );
    const orderId = await resolveKashierRefundOrderId(
      input.payment.kashierSessionId ?? null,
      input.payment.kashierOrderId ?? null,
    );
    if (!orderId) {
      gatewayRefundFailed = true;
      timelineEvents.push({ event: "kashier_refund_skipped_no_order" });
    } else {
      const result = await refundKashierPayment(
        orderId,
        gatewayRefundEgp,
        input.reason,
      );
      if (result.status === "succeeded")
        attemptedKashierRefundId = result.refundId;
      if (
        result.status === "succeeded" &&
        (!result.refundId || previouslyRecordedRefundIds.has(result.refundId))
      ) {
        gatewayRefundPending = true;
        gatewayRefundDuplicate = Boolean(result.refundId);
        timelineEvents.push({
          event: result.refundId
            ? "kashier_refund_duplicate_reference"
            : "kashier_refund_unconfirmed",
          detail: `${gatewayRefundEgp} EGP — verify with Kashier before retrying`,
        });
      } else if (result.status === "succeeded") {
        kashierRefundId = result.refundId;
        await WalletTransaction.create({
          userId: input.payment.userId,
          type: "payment_refund_partial",
          amountEgp: gatewayRefundEgp,
          status: "completed",
          description: `Kashier refund for booking ${input.payment.bookingId}${input.reason ? ` — ${input.reason}` : ""}`,
          paymentId: input.payment._id,
          bookingId: input.payment.bookingId,
          tripId: new Types.ObjectId(input.tripId),
          refundOperationId: input.operationId,
          kashierOrderId: orderId,
          ...(result.refundId ? { kashierRefundId: result.refundId } : {}),
          kashierTransactionIds: result.refundId ? [result.refundId] : [],
        });
        timelineEvents.push({
          event: "kashier_refunded",
          detail: `${gatewayRefundEgp} EGP${result.refundId ? ` ref ${result.refundId}` : ""}`,
        });
      } else if (result.status === "failed") {
        gatewayRefundFailed = true;
        gatewayRefundRetrySafe = true;
        timelineEvents.push({
          event: "kashier_refund_failed",
          detail: `${gatewayRefundEgp} EGP — verify the final status before retrying`,
        });
      } else {
        gatewayRefundPending = true;
        timelineEvents.push({
          event: "kashier_refund_unconfirmed",
          detail: `${gatewayRefundEgp} EGP — verify with Kashier before retrying`,
        });
      }
    }
  }

  return {
    walletCapturedEgp,
    walletAlreadyRefundedEgp,
    gatewayAlreadyRefundedEgp,
    walletRefundEgp,
    gatewayRefundEgp,
    confirmedGatewayRefundEgp:
      gatewayRefundFailed || gatewayRefundPending ? 0 : gatewayRefundEgp,
    walletRefundTxId,
    kashierRefundId,
    attemptedKashierRefundId,
    gatewayRefundFailed,
    gatewayRefundPending,
    gatewayRefundDuplicate,
    gatewayRefundRetrySafe,
    timelineEvents,
  };
}

export async function disburseLegacyWalletRefund(input: {
  operationId: string;
  userId: string;
  bookingId: string;
  tripId: string;
  amountEgp: number;
  reason?: string;
}): Promise<{ transactionId: Types.ObjectId; amountEgp: number }> {
  if (
    !Types.ObjectId.isValid(input.userId) ||
    !Types.ObjectId.isValid(input.bookingId) ||
    !Types.ObjectId.isValid(input.tripId) ||
    !Number.isSafeInteger(input.amountEgp) ||
    input.amountEgp <= 0
  ) {
    throw new RangeError(
      "Legacy refund requires valid records and a positive whole EGP amount.",
    );
  }
  return creditRefundWalletOnce({
    operationId: input.operationId,
    userId: new Types.ObjectId(input.userId),
    bookingId: new Types.ObjectId(input.bookingId),
    tripId: input.tripId,
    amountEgp: input.amountEgp,
    reason: input.reason,
  });
}
