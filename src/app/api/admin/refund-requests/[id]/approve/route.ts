import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { RefundRequest } from "@/models/RefundRequest";
import { Trip } from "@/models/Trip";
import { Payment } from "@/models/Payment";
import { Wallet } from "@/models/Wallet";
import { WalletTransaction } from "@/models/WalletTransaction";
import { Log } from "@/models/Log";
import mongoose from "mongoose";

type ClaimedRefundRequest = {
  _id: { toString(): string };
  tripId: mongoose.Types.ObjectId;
  passengerId: mongoose.Types.ObjectId;
  refundAmount: number;
  tier: string;
};

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();
    const dbSession = await mongoose.startSession();
    let refundReq: ClaimedRefundRequest | null = null;
    let balanceAfterEgp = 0;
    let responseRefundAmount = 0;

    await dbSession.withTransaction(async () => {
      refundReq = await RefundRequest.findOneAndUpdate(
        { _id: id, status: "pending" },
        {
          $set: {
            status: "approved",
            reviewedAt: new Date(),
            reviewedBy: session.userId,
          },
        },
        { new: true, session: dbSession },
      ).lean<ClaimedRefundRequest | null>();

      if (!refundReq)
        throw new Error(
          "Refund request not found or has already been reviewed.",
        );

      const refundAmount = refundReq.refundAmount;
      responseRefundAmount = refundAmount;
      const trip = await Trip.findById(refundReq.tripId)
        .select("requestId")
        .session(dbSession);
      const payment = trip?.requestId
        ? await Payment.findOne({
            bookingId: trip.requestId,
            overallStatus: { $in: ["paid", "partially_refunded"] },
          })
            .sort({ createdAt: -1 })
            .session(dbSession)
        : null;

      const wallet = await Wallet.findOneAndUpdate(
        { userId: refundReq.passengerId },
        {
          $inc: { balanceEgp: refundAmount, totalCreditedEgp: refundAmount },
          $set: { lastTransactionAt: new Date() },
        },
        { new: true, upsert: true, session: dbSession, runValidators: true },
      );
      balanceAfterEgp = wallet.balanceEgp;

      await WalletTransaction.create(
        [
          {
            userId: refundReq.passengerId,
            type: "refund",
            amountEgp: refundAmount,
            status: "completed",
            description: `Admin approved cancellation refund for trip`,
            balanceAfterEgp: wallet.balanceEgp,
            tripId: refundReq.tripId,
            bookingId: trip?.requestId,
            paymentId: payment?._id,
          },
        ],
        { session: dbSession },
      );

      if (payment) {
        const updatedPayment = await Payment.findOneAndUpdate(
          { _id: payment._id },
          {
            $inc: { refundedAmountEgp: refundAmount },
            $set: { refundedAt: new Date() },
            $push: {
              timeline: {
                event: "passenger_cancellation_refunded",
                detail: `${refundAmount} EGP for trip ${refundReq.tripId}`,
              },
            },
          },
          { new: true, session: dbSession },
        );
        if (updatedPayment) {
          await Payment.updateOne(
            { _id: updatedPayment._id },
            {
              $set: {
                overallStatus:
                  updatedPayment.refundedAmountEgp >= updatedPayment.totalEgp
                    ? "refunded"
                    : "partially_refunded",
              },
            },
            { session: dbSession },
          );
        }
      }

      await Trip.findByIdAndUpdate(refundReq.tripId, {
        $set: {
          "cancellation.refundStatus": "approved",
        },
      }).session(dbSession);

      await Log.create(
        [
          {
            actor: session.userId,
            actorType: "admin",
            action: "refund_request_approved",
            target: refundReq._id.toString(),
            targetType: "refund_request",
            details: {
              tripId: refundReq.tripId,
              passengerId: refundReq.passengerId,
              refundAmount: refundReq.refundAmount,
              tier: refundReq.tier,
            },
          },
        ],
        { session: dbSession },
      );
    });
    await dbSession.endSession();

    if (!refundReq) {
      return NextResponse.json(
        { error: "Refund request not found or has already been reviewed." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Refund request approved. Credited ${responseRefundAmount} EGP to passenger wallet.`,
      balanceAfterEgp,
      refundRequest: refundReq,
    });
  } catch (error: any) {
    console.error("Error approving refund request:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
