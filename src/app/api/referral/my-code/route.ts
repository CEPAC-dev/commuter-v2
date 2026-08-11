import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { generateReferralCode } from "@/lib/referral";
import { ReferralUsage } from "@/models/ReferralUsage";
import { User } from "@/models/User";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const user = await User.findById(session.userId).select("referralCode");
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (!user.referralCode) {
    user.referralCode = await generateReferralCode();
    await user.save();
  }

  const [total, active, exhausted, remainingResult] = await Promise.all([
    ReferralUsage.countDocuments({ referrer: user._id }),
    ReferralUsage.countDocuments({ referrer: user._id, status: "active" }),
    ReferralUsage.countDocuments({ referrer: user._id, status: "exhausted" }),
    ReferralUsage.aggregate<{ total: number }>([
      { $match: { referrer: user._id, status: "active" } },
      { $group: { _id: null, total: { $sum: "$tripsRemaining" } } },
    ]),
  ]);

  const shareUrl = new URL("/login", req.nextUrl.origin);
  shareUrl.searchParams.set("ref", user.referralCode);

  return NextResponse.json({
    data: {
      referralCode: user.referralCode,
      shareUrl: shareUrl.toString(),
      stats: {
        total,
        active,
        exhausted,
        tripsRemaining: remainingResult[0]?.total ?? 0,
      },
    },
  });
}