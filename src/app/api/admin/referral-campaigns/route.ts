import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import {
  AdminReferralCampaign,
  ADMIN_REFERRAL_ROLES,
  type AdminReferralRole,
} from "@/models/AdminReferralCampaign";
import { AdminReferralUsage } from "@/models/AdminReferralUsage";
import { AdminReferralAuditLog } from "@/models/AdminReferralAuditLog";
import { User } from "@/models/User";

function parseRole(value: unknown): AdminReferralRole | null {
  return ADMIN_REFERRAL_ROLES.includes(value as AdminReferralRole)
    ? (value as AdminReferralRole)
    : null;
}

function requestOrigin(req: NextRequest) {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProtocol = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost ?? req.headers.get("host") ?? req.nextUrl.host;
  const protocol = forwardedProtocol ?? req.nextUrl.protocol.replace(":", "");
  return `${protocol}://${host}`;
}

function serializeCampaign(campaign: {
  _id: unknown;
  role: AdminReferralRole;
  token: string;
  rewardAmount: number;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
}, origin: string) {
  const link = new URL("/login", origin);
  link.searchParams.set("redirect", "/create");
  link.searchParams.set("ref", campaign.token);
  link.searchParams.set("refRole", campaign.role);
  return {
    id: String(campaign._id),
    role: campaign.role,
    token: campaign.token,
    rewardAmount: campaign.rewardAmount,
    maxUses: campaign.maxUses,
    usedCount: campaign.usedCount,
    isActive: campaign.isActive,
    shareUrl: link.toString(),
  };
}

async function snapshotUser(userId: string) {
  const user = await User.findById(userId).select("name userNumber phone").lean();
  return {
    name: user?.name ?? "Unknown admin",
    userNumber: user?.userNumber ?? null,
    phone: user?.phone ?? "",
  };
}

export async function GET(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  await connectDB();

  const campaigns = await Promise.all(
    ADMIN_REFERRAL_ROLES.map(async (role) => {
      const existing = await AdminReferralCampaign.findOne({ role });
      if (existing) return existing.toObject();
      return AdminReferralCampaign.create({
        role,
        token: `ADMIN-${role.toUpperCase()}-${new Types.ObjectId().toString().slice(-10).toUpperCase()}`,
        rewardAmount: 100,
        maxUses: 5,
        usedCount: 0,
        isActive: false,
        createdBy: auth.userId,
      });
    }),
  );

  const usageCounts = await AdminReferralUsage.aggregate<{ _id: unknown; count: number }>([
    { $group: { _id: "$campaignId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(usageCounts.map((item) => [String(item._id), item.count]));
  const auditLogs = await AdminReferralAuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  const usages = await AdminReferralUsage.find({ status: "credited" })
    .sort({ createdAt: -1 })
    .select("campaignId recipientUserId createdAt")
    .lean();
  const recipientIds = usages.map((usage) => usage.recipientUserId);
  const recipients = await User.find({ _id: { $in: recipientIds } })
    .select("_id name userNumber phone")
    .lean();
  const recipientMap = new Map(recipients.map((recipient) => [String(recipient._id), recipient]));
  const registrantsByCampaign = new Map<string, Array<{
    name: string;
    userNumber: number;
    phone: string;
    registeredAt: Date;
  }>>();
  for (const usage of usages) {
    const recipient = recipientMap.get(String(usage.recipientUserId));
    if (!recipient) continue;
    const registrants = registrantsByCampaign.get(String(usage.campaignId)) ?? [];
    registrants.push({
      name: recipient.name,
      userNumber: recipient.userNumber ?? registrants.length + 1,
      phone: recipient.phone,
      registeredAt: usage.createdAt,
    });
    registrantsByCampaign.set(String(usage.campaignId), registrants);
  }
  const origin = requestOrigin(req);
  return NextResponse.json({
    campaigns: campaigns.map((campaign) => ({
      ...serializeCampaign(campaign, origin),
      usedCount: countMap.get(String(campaign._id)) ?? campaign.usedCount,
      registrants: registrantsByCampaign.get(String(campaign._id)) ?? [],
      history: auditLogs
        .filter((log) => String(log.campaignId) === String(campaign._id))
        .map((log) => ({
          id: String(log._id),
          eventType: log.eventType,
          createdAt: log.createdAt,
          actor: log.actorSnapshot,
          recipient: log.recipientSnapshot,
          metadata: log.metadata,
        })),
    })),
  });
}

export async function PUT(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const role = parseRole(body.role);
  const rewardAmount = Number(body.rewardAmount);
  const maxUses = body.unlimited === true || body.maxUses === null ? null : Number(body.maxUses);
  const isActive = body.isActive;
  if (!role) return NextResponse.json({ error: "Role must be passenger or driver." }, { status: 400 });
  if (!Number.isFinite(rewardAmount) || rewardAmount < 0.01) return NextResponse.json({ error: "Reward must be at least 0.01 EGP." }, { status: 400 });
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return NextResponse.json({ error: "Maximum uses must be a positive integer or unlimited." }, { status: 400 });
  if (typeof isActive !== "boolean") return NextResponse.json({ error: "isActive must be a boolean." }, { status: 400 });

  await connectDB();
  const campaign = await AdminReferralCampaign.findOne({ role });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const previousActive = campaign.isActive;
  campaign.rewardAmount = rewardAmount;
  campaign.maxUses = maxUses;
  campaign.isActive = isActive;
  await campaign.save();

  const actorSnapshot = await snapshotUser(auth.userId);
  const eventType = previousActive !== isActive
    ? (isActive ? "activated" : "deactivated")
    : "updated";
  await AdminReferralAuditLog.create({
    campaignId: campaign._id,
    eventType,
    actorId: auth.userId,
    actorSnapshot,
    metadata: { rewardAmount, maxUses, isActive },
  });
  return NextResponse.json({ data: serializeCampaign(campaign, requestOrigin(req)) });
}
