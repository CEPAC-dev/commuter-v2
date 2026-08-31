import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { RefundRequest } from "@/models/RefundRequest";
import { Trip } from "@/models/Trip";
import { Wallet } from "@/models/Wallet";
import { WalletTransaction } from "@/models/WalletTransaction";
import { Log } from "@/models/Log";

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

    // Optimistic locking: update strictly if status === "pending"
    const refundReq = await RefundRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      {
        $set: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: session.userId,
        },
      },
      { new: true },
    );

    if (!refundReq) {
      return NextResponse.json(
        { error: "Refund request not found or has already been reviewed." },
        { status: 400 },
      );
    }

    const refundAmount = refundReq.refundAmount;

    // Credit passenger wallet
    let wallet = await Wallet.findOne({ userId: refundReq.passengerId });
    if (!wallet) {
      wallet = await Wallet.create({
        userId: refundReq.passengerId,
        balanceEgp: 0,
        totalCreditedEgp: 0,
        totalDebitedEgp: 0,
      });
    }

    wallet.balanceEgp += refundAmount;
    wallet.totalCreditedEgp += refundAmount;
    wallet.lastTransactionAt = new Date();
    await wallet.save();

    await WalletTransaction.create({
      userId: refundReq.passengerId,
      type: "refund",
      amountEgp: refundAmount,
      status: "completed",
      description: `Admin approved cancellation refund for trip`,
      balanceAfterEgp: wallet.balanceEgp,
      tripId: refundReq.tripId,
    });

    // Update linked trip cancellation refundStatus
    if (refundReq.tripId) {
      await Trip.findByIdAndUpdate(refundReq.tripId, {
        $set: {
          "cancellation.refundStatus": "approved",
        },
      });
    }

    // Log admin approval
    try {
      await Log.create({
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
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Refund request approved. Credited ${refundAmount} EGP to passenger wallet.`,
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
