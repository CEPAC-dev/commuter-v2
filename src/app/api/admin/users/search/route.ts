import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { ReferralUsage } from "@/models/ReferralUsage";
import { getOrCreateReferralSettings } from "@/lib/referral";

export async function GET(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ data: [] });
  }

  await connectDB();

  let searchFilter: Record<string, unknown>;

  if (query.startsWith("#")) {
    const cleanQuery = query.replace(/^#\s*/, "").trim();
    if (!/^\d+$/.test(cleanQuery)) {
      return NextResponse.json({ data: [] });
    }
    const userNum = Number.parseInt(cleanQuery, 10);
    searchFilter = { userNumber: userNum };
  } else {
    searchFilter = {
      $or: [
        { name: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
      ],
    };
  }

  const users = await User.find(searchFilter)
    .select("_id userNumber name role phone referralCode referralUnlimited")
    .limit(20)
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

  return NextResponse.json({ data: results });
}
