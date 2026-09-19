import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { ReferralUsage } from "@/models/ReferralUsage";
import { getOrCreateReferralSettings } from "@/lib/referral";

export async function GET(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  await connectDB();

  const users = await User.find({ referralUnlimited: true })
    .select("_id userNumber name role phone referralCode referralUnlimited")
    .lean();

  const [passengerSettings, driverSettings] = await Promise.all([
    getOrCreateReferralSettings("passenger"),
    getOrCreateReferralSettings("driver"),
  ]);

  const results = await Promise.all(
    users.map(async (u) => {
      const [total, credited] = await Promise.all([
        ReferralUsage.countDocuments({ referrer: u._id }),
        ReferralUsage.countDocuments({ referrer: u._id, status: "credited" }),
      ]);

      const cap =
        u.role === "driver"
          ? driverSettings.maxUsersPerCode
          : passengerSettings.maxUsersPerCode;

      return {
        id: String(u._id),
        userNumber: u.userNumber ?? null,
        name: u.name,
        role: u.role,
        phone: u.phone,
        referralCode: u.referralCode ?? null,
        referralUnlimited: Boolean(u.referralUnlimited),
        usageCount: total,
        creditedCount: credited,
        maxUsersPerCode: cap,
      };
    }),
  );

  // Sort by usage count descending as a helpful default
  results.sort((a, b) => b.usageCount - a.usageCount);

  return NextResponse.json({ data: results });
}
