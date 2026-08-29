import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { Types } from "mongoose";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id || !Types.ObjectId.isValid(id))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await connectDB();

  const payment = await Payment.findOne({
    _id: id,
    userId: new Types.ObjectId(session.userId),
  }).lean<Record<string, unknown> | null>();

  if (!payment)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: String(payment._id),
    bookingId: String(payment.bookingId),
    totalEgp: payment.totalEgp,
    walletAmountEgp: payment.walletAmountEgp,
    gatewayAmountEgp: payment.gatewayAmountEgp,
    walletStatus: payment.walletStatus,
    gatewayStatus: payment.gatewayStatus,
    overallStatus: payment.overallStatus,
    paidAt: payment.paidAt,
    timeline: payment.timeline ?? [],
  });
}
