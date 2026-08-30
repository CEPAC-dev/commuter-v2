import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { ReferralUsage } from "@/models/ReferralUsage";

export async function GET(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  await connectDB();

  const { searchParams } = new URL(req.url);
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
  const skip = (safePage - 1) * safeLimit;

  const [users, totalCount] = await Promise.all([
    User.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .select("-passwordHash")
      .lean(),
    User.countDocuments(),
  ]);

  const userIds = users.map((user) => user._id);
  const referralUsageCounts = await ReferralUsage.aggregate<{
    _id: unknown;
    count: number;
  }>([
    { $match: { referrer: { $in: userIds } } },
    { $group: { _id: "$referrer", count: { $sum: 1 } } },
  ]);
  const referralUsageMap = new Map(
    referralUsageCounts.map((item) => [String(item._id), item.count]),
  );

  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      referralUsageCount: referralUsageMap.get(String(user._id)) ?? 0,
    })),
    totalCount,
    page: safePage,
    limit: safeLimit,
  });
}
