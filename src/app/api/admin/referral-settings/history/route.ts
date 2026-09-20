import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { ReferralAuditLog } from "@/models/ReferralAuditLog";

export async function GET() {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  await connectDB();
  const logs = await ReferralAuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const referralGroups = new Map<
    string,
    {
      id: string;
      eventType: "referral_added";
      createdAt: Date;
      actorUserId: string;
      actor: (typeof logs)[number]["actorSnapshot"];
      targets: (typeof logs)[number]["targetSnapshot"][];
    }
  >();
  const unlimited = logs.filter(
    (log) =>
      log.eventType === "unlimited_activated" ||
      log.eventType === "unlimited_deactivated",
  );

  for (const log of logs.filter((item) => item.eventType === "referral_added")) {
    const createdAt = new Date(log.createdAt);
    const key = String(log.actorId);
    const existing = referralGroups.get(key);
    if (existing) {
      existing.targets.push(log.targetSnapshot);
      if (createdAt.getTime() > new Date(existing.createdAt).getTime()) {
        existing.createdAt = log.createdAt;
        existing.id = String(log._id);
      }
    } else {
      referralGroups.set(key, {
        id: String(log._id),
        eventType: "referral_added",
        createdAt: log.createdAt,
        actorUserId: String(log.actorId),
        actor: log.actorSnapshot,
        targets: [log.targetSnapshot],
      });
    }
  }

  return NextResponse.json({
    referralAdded: Array.from(referralGroups.values()),
    unlimitedActivated: unlimited.map((log) => ({
      id: String(log._id),
      eventType: log.eventType,
      createdAt: log.createdAt,
      targetUserId: String(log.targetUserId),
      actor: log.actorSnapshot,
      target: log.targetSnapshot,
    })),
  });
}
