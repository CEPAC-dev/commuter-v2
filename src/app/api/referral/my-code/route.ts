import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { generateReferralCode, getOrCreateReferralSettings } from "@/lib/referral";
import { ReferralUsage } from "@/models/ReferralUsage";
import { User } from "@/models/User";
import { Wallet } from "@/models/Wallet";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const user = await User.findById(session.userId).select("referralCode referralUnlimited");
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (!user.referralCode) {
    user.referralCode = await generateReferralCode();
    await user.save();
  }

  const [total, pending, credited, wallet, settings] = await Promise.all([
    ReferralUsage.countDocuments({ referrer: user._id }),
    ReferralUsage.countDocuments({ referrer: user._id, status: "pending" }),
    ReferralUsage.countDocuments({ referrer: user._id, status: "credited" }),
    Wallet.findOne({ userId: user._id }).select("balanceEgp").lean(),
    getOrCreateReferralSettings(session.role === "driver" ? "driver" : "passenger"),
  ]);

  const shareUrl = new URL("/login", req.nextUrl.origin);
  shareUrl.searchParams.set("ref", user.referralCode);

  return NextResponse.json({
    data: {
      referralCode: user.referralCode,
      shareUrl: shareUrl.toString(),
      balanceEgp: wallet?.balanceEgp ?? 0,
      referrerBonusAmount: settings.referrerBonusAmount,
      maxUsersPerCode: settings.maxUsersPerCode,
      referralUnlimited: Boolean(user.referralUnlimited),
      stats: {
        total,
        pending,
        credited,
      },
    },
  });
}