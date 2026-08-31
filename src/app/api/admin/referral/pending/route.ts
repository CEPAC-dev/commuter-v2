import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { ReferralUsage } from "@/models/ReferralUsage";

export async function GET(_req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  await connectDB();

  const pending = await ReferralUsage.find({ status: "pending" })
    .populate("referrer", "name phone email role")
    .populate("referredUser", "name phone email role")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    data: pending.map((item) => ({
      id: String(item._id),
      status: item.status,
      referrerBonusAmount: item.referrerBonusAmount,
      refereeBonusAmount: item.refereeBonusAmount,
      referrer: item.referrer,
      referredUser: item.referredUser,
      createdAt: item.createdAt,
    })),
  });
}
