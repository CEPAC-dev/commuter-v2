import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { User } from "@/models/User";

export async function GET(request: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const limited = await enforceRateLimit(request, "admin-support-user-search", {
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100)
    return NextResponse.json({ data: [] });

  await connectDB();

  const users = query.startsWith("#") && /^\d+$/.test(query.slice(1).trim())
    ? await User.find({
        userNumber: Number(query.slice(1).trim()),
        role: { $in: ["passenger", "driver"] },
      })
        .select("_id userNumber name email phone role")
        .limit(10)
        .lean()
    : await User.find({
        role: { $in: ["passenger", "driver"] },
        $or: [
          { name: { $regex: escapeRegex(query), $options: "i" } },
          { email: { $regex: escapeRegex(query), $options: "i" } },
          { phone: { $regex: escapeRegex(query), $options: "i" } },
        ],
      })
        .select("_id userNumber name email phone role")
        .limit(10)
        .lean();

  return NextResponse.json({
    data: users.map((user) => ({
      id: String(user._id),
      userNumber: user.userNumber ?? null,
      name: user.name,
      email: user.email ?? "",
      phone: user.phone,
      role: user.role,
    })),
  });
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
