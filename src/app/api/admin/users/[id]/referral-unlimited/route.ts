import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { ReferralAuditLog } from "@/models/ReferralAuditLog";
import { Types } from "mongoose";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (typeof body.unlimited !== "boolean") {
    return NextResponse.json(
      { error: "unlimited must be a boolean." },
      { status: 400 },
    );
  }

  await connectDB();

  const existingUser = await User.findById(id)
    .select("referralUnlimited")
    .lean<{ referralUnlimited?: boolean }>();
  if (!existingUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const user = await User.findByIdAndUpdate(
    id,
    { $set: { referralUnlimited: body.unlimited } },
    { returnDocument: "after" },
  ).select("_id userNumber name role phone referralUnlimited");

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  let auditWarning: string | undefined;
  if (Boolean(existingUser.referralUnlimited) !== body.unlimited) {
    try {
      const admin = await User.findById(auth.userId).select("name userNumber phone").lean();
      await ReferralAuditLog.create({
        eventType: body.unlimited ? "unlimited_activated" : "unlimited_deactivated",
        actorId: auth.userId,
        targetUserId: user._id,
        actorSnapshot: {
          name: admin?.name ?? "Unknown admin",
          userNumber: admin?.userNumber ?? null,
          phone: admin?.phone ?? "",
        },
        targetSnapshot: {
          name: user.name ?? "Unknown user",
          userNumber: user.userNumber ?? null,
          phone: user.phone ?? "",
        },
      });
    } catch (error) {
      console.error("Referral unlimited audit log failed:", error);
      auditWarning = "Unlimited Referral changed, but the history entry could not be saved.";
    }
  }

  return NextResponse.json({
    data: {
      id: String(user._id),
      referralUnlimited: Boolean(user.referralUnlimited),
      ...(auditWarning ? { auditWarning } : {}),
    },
  });
}
