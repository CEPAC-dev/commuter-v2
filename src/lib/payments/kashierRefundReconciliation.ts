import { Payment } from "@/models/Payment";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { WalletTransaction } from "@/models/WalletTransaction";
import { Types } from "mongoose";

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

export async function reconcileKashierRefund(
  paymentId: string,
  amountEgp: number,
  refundId: string,
  orderId: string | null,
  options: { associateTrip?: boolean } = {},
): Promise<{ tripId: string | null; alreadyRecorded: boolean }> {
  if (
    !Types.ObjectId.isValid(paymentId) ||
    !Number.isFinite(amountEgp) ||
    amountEgp <= 0 ||
    !refundId
  ) {
    throw new Error("Invalid Kashier refund details");
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error("Payment not found for Kashier refund");

  let refundLedger = await WalletTransaction.findOne({
    paymentId: payment._id,
    type: "payment_refund_partial",
    $or: [{ kashierRefundId: refundId }, { kashierTransactionIds: refundId }],
  });

  const relatedTrips = await Trip.find({
    requestId: payment.bookingId,
    "adminRefund.paymentId": payment._id,
    "adminRefund.status": { $in: ["processing", "failed"] },
  })
    .select("_id status priceEgp adminRefund")
    .lean<
      {
        _id: Types.ObjectId;
        status: string;
        priceEgp: number;
        adminRefund?: {
          status?: string;
          refundAmountEgp?: number;
          gatewayRefundAmountEgp?: number;
          kashierRefundId?: string;
          failureReason?: string;
        };
      }[]
    >();
  const matchingTrips =
    options.associateTrip === false
      ? []
      : relatedTrips.filter((trip) => {
    const adminRefund = trip.adminRefund;
    if (!adminRefund) return false;
    const currentRefund = adminRefund.refundAmountEgp ?? 0;
    const fitsTripBalance = currentRefund + amountEgp <= trip.priceEgp;
    return (
      fitsTripBalance &&
      (adminRefund.kashierRefundId === refundId ||
        (adminRefund.gatewayRefundAmountEgp != null
          ? adminRefund.gatewayRefundAmountEgp === amountEgp
          : adminRefund.status === "failed" &&
            adminRefund.failureReason?.toLowerCase().includes("kashier") ===
              true &&
            Math.max(0, trip.priceEgp - currentRefund) === amountEgp))
    );
  });
  let matchingTrip = matchingTrips.length === 1 ? matchingTrips[0] : null;
  if (refundLedger?.tripId) {
    matchingTrip =
      relatedTrips.find(
        (trip) => String(trip._id) === String(refundLedger?.tripId),
      ) ?? null;
  }

  if (refundLedger && refundLedger.amountEgp !== amountEgp) {
    throw new Error("Kashier refund reference amount does not match the ledger");
  }

  let alreadyRecorded = Boolean(refundLedger);
  if (!refundLedger) {
    const confirmedGatewayRefunds = await WalletTransaction.aggregate<{
      amountEgp: number;
    }>([
      {
        $match: {
          paymentId: payment._id,
          type: "payment_refund_partial",
          status: "completed",
        },
      },
      { $group: { _id: null, amountEgp: { $sum: "$amountEgp" } } },
    ]);
    const alreadyRefundedGateway = confirmedGatewayRefunds[0]?.amountEgp ?? 0;
    if (amountEgp > payment.gatewayAmountEgp - alreadyRefundedGateway) {
      throw new Error("Kashier refund exceeds the remaining gateway amount");
    }

    try {
      refundLedger = await WalletTransaction.create({
        userId: payment.userId,
        type: "payment_refund_partial",
        amountEgp,
        status: "completed",
        description: `Kashier refund for booking ${payment.bookingId}`,
        paymentId: payment._id,
        bookingId: payment.bookingId,
        ...(matchingTrip ? { tripId: matchingTrip._id } : {}),
        kashierOrderId: orderId ?? payment.kashierOrderId,
        kashierRefundId: refundId,
        kashierTransactionIds: [refundId],
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      refundLedger = await WalletTransaction.findOne({
        kashierRefundId: refundId,
        paymentId: payment._id,
        type: "payment_refund_partial",
      });
      if (!refundLedger) throw error;
      if (refundLedger.amountEgp !== amountEgp)
        throw new Error(
          "Kashier refund reference is already linked to a different amount",
        );
      alreadyRecorded = true;
    }
  }

  if (!refundLedger) throw new Error("Unable to record Kashier refund");

  const refundTotals = await WalletTransaction.aggregate<{
    walletAmountEgp: number;
    gatewayAmountEgp: number;
  }>([
    {
      $match: {
        paymentId: payment._id,
        status: "completed",
        type: { $in: ["refund", "payment_refund_partial"] },
      },
    },
    {
      $group: {
        _id: null,
        walletAmountEgp: {
          $sum: {
            $cond: [{ $eq: ["$type", "refund"] }, "$amountEgp", 0],
          },
        },
        gatewayAmountEgp: {
          $sum: {
            $cond: [
              { $eq: ["$type", "payment_refund_partial"] },
              "$amountEgp",
              0,
            ],
          },
        },
      },
    },
  ]);
  const walletRefundedEgp = refundTotals[0]?.walletAmountEgp ?? 0;
  const gatewayRefundedEgp = refundTotals[0]?.gatewayAmountEgp ?? 0;
  const refundedAmountEgp = Math.min(
    payment.totalEgp,
    walletRefundedEgp + gatewayRefundedEgp,
  );
  const paymentUpdate: Record<string, unknown> = {
    refundedAmountEgp,
    ...(refundedAmountEgp > 0 ? { refundedAt: new Date() } : {}),
    ...(payment.overallStatus === "cancelled"
      ? {}
      : {
          overallStatus:
            refundedAmountEgp >= payment.totalEgp
              ? "refunded"
              : "partially_refunded",
        }),
    ...(payment.walletAmountEgp > 0 &&
    walletRefundedEgp >= payment.walletAmountEgp
      ? { walletStatus: "refunded" }
      : {}),
    ...(payment.gatewayAmountEgp > 0 &&
    gatewayRefundedEgp >= payment.gatewayAmountEgp
      ? { gatewayStatus: "refunded" }
      : {}),
  };
  await Payment.updateOne(
    { _id: payment._id },
    {
      $set: paymentUpdate,
      $addToSet: { kashierRefundIds: refundId },
    },
  );

  if (
    payment.overallStatus !== "cancelled" &&
    refundedAmountEgp >= payment.totalEgp
  ) {
    await Request.updateOne(
      { _id: payment.bookingId },
      { $set: { paymentStatus: "refunded" } },
    );
  }

  if (matchingTrip) {
    const currentRefund = matchingTrip.adminRefund?.refundAmountEgp ?? 0;
    const currentCompensation =
      (
        matchingTrip.adminRefund as
          | { compensationAmountEgp?: number }
          | undefined
      )?.compensationAmountEgp ?? 0;
    const refundedTripAmountEgp = currentRefund + amountEgp;
    const fullyRefundedTrip = refundedTripAmountEgp >= matchingTrip.priceEgp;
    const totalReturnEgp = refundedTripAmountEgp + currentCompensation;
    await Trip.updateOne(
      {
        _id: matchingTrip._id,
        "adminRefund.status": { $in: ["processing", "failed"] },
      },
      {
        $set: {
          ...(fullyRefundedTrip
            ? { status: "refunded", paymentStatus: "refunded" }
            : {}),
          "adminRefund.status": fullyRefundedTrip ? "completed" : "failed",
          "adminRefund.refundAmountEgp": refundedTripAmountEgp,
          "adminRefund.totalReturnEgp": totalReturnEgp,
          "adminRefund.refundedAt": new Date(),
          "adminRefund.retryAllowed": !fullyRefundedTrip,
          ...(!fullyRefundedTrip
            ? {
                "adminRefund.failureReason":
                  "Kashier confirmed a partial refund; remaining trip balance may be refunded",
              }
            : {}),
        },
        ...(fullyRefundedTrip
          ? { $unset: { "adminRefund.failureReason": 1 } }
          : {}),
      },
    );
  }

  return {
    tripId: matchingTrip ? String(matchingTrip._id) : null,
    alreadyRecorded,
  };
}
