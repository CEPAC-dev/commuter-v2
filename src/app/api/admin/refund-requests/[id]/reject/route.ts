import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { RefundRequest } from "@/models/RefundRequest";
import { Trip } from "@/models/Trip";
import { Log } from "@/models/Log";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = body.reason || "Rejected by administrator";

    await connectDB();

    // Optimistic locking: update strictly if status === "pending"
    const refundReq = await RefundRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      {
        $set: {
          status: "rejected",
          rejectionReason: reason,
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

    // Update linked trip cancellation refundStatus
    if (refundReq.tripId) {
      await Trip.findByIdAndUpdate(refundReq.tripId, {
        $set: {
          "cancellation.refundStatus": "rejected",
        },
      });
    }

    // Log admin rejection
    try {
      await Log.create({
        actor: session.userId,
        actorType: "admin",
        action: "refund_request_rejected",
        target: refundReq._id.toString(),
        targetType: "refund_request",
        details: {
          tripId: refundReq.tripId,
          passengerId: refundReq.passengerId,
          refundAmount: refundReq.refundAmount,
          tier: refundReq.tier,
          reason,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: "Refund request rejected.",
      refundRequest: refundReq,
    });
  } catch (error: any) {
    console.error("Error rejecting refund request:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
