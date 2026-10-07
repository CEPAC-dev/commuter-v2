import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";
import { AdminActivityNotification } from "@/models/AdminActivityNotification";
import { User } from "@/models/User";
import { sendPushToUserNotification } from "@/lib/notifications/webPush";

const RECIPIENT_ROLES = new Set(["passenger", "driver"]);
const ICONS = new Set(["bell", "info", "megaphone", "check", "alert"]);
const STYLES = new Set(["info", "success", "warning", "urgent"]);

function getBroadcastStatus(item: {
  deliveryStatus?: string | null;
  deliveredAt?: Date | null;
  seenAt?: Date | null;
  isRead?: boolean;
}) {
  if (item.isRead) return "read";
  if (item.seenAt) return "seen";
  if (item.deliveredAt || item.deliveryStatus === "delivered")
    return "delivered";
  if (item.deliveryStatus === "seen") return "seen";
  return item.deliveryStatus ?? "pending";
}

type Audience = "all" | "passengers" | "drivers" | "created" | "selected";

function startOfDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(value: string) {
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalisePath(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const link = value.trim();
  if (link.startsWith("/")) return link.slice(0, 300);
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().slice(0, 300);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const page = Math.max(
    1,
    Number.parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1,
  );
  const pageSize = Math.min(
    Math.max(
      1,
      Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "5", 10) || 5,
    ),
    25,
  );
  const status = (req.nextUrl.searchParams.get("status") ?? "all").trim();
  const role = (req.nextUrl.searchParams.get("role") ?? "all").trim();
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);

  await connectDB();

  const userQuery: Record<string, unknown> = {
    role: { $in: ["passenger", "driver"] },
  };
  if (role !== "all" && (role === "passenger" || role === "driver")) {
    userQuery.role = role;
  }
  if (query) {
    const matcher = new RegExp(
      query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    userQuery.$or = [{ name: matcher }, { email: matcher }, { phone: matcher }];
  }
  const matchingUsers = await User.find(userQuery).select("_id").lean();
  const matchingUserIds = matchingUsers.map((user) => user._id);

  const baseFilter: Record<string, unknown> = {
    type: "admin_broadcast",
    userId: matchingUserIds.length ? { $in: matchingUserIds } : { $in: [] },
  };

  if (status !== "all") {
    const statusPredicate: Record<string, unknown> = {};
    switch (status) {
      case "pending":
        statusPredicate.$or = [
          { deliveryStatus: "pending" },
          { deliveredAt: null, seenAt: null, isRead: false },
        ];
        break;
      case "delivered":
        statusPredicate.$or = [
          { deliveryStatus: "delivered" },
          { deliveredAt: { $ne: null }, seenAt: null, isRead: false },
        ];
        break;
      case "seen":
        statusPredicate.$or = [
          { deliveryStatus: "seen" },
          { seenAt: { $ne: null }, isRead: false },
        ];
        break;
      case "read":
        statusPredicate.isRead = true;
        break;
      default:
        break;
    }
    Object.assign(baseFilter, statusPredicate);
  }

  const total = await Notification.countDocuments(baseFilter);
  const broadcasts = await Notification.find(baseFilter)
    .populate("userId", "name email phone role")
    .sort({ sentAt: -1, createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();

  const data = broadcasts.map((item) => {
    const user = item.userId as {
      _id?: unknown;
      name?: string;
      email?: string;
      phone?: string;
      role?: string;
    } | null;
    const recipient = user
      ? {
          id: String(user._id ?? item.userId),
          name: user.name ?? "Unknown user",
          email: user.email ?? undefined,
          phone: user.phone ?? undefined,
          role: (user.role as "passenger" | "driver") ?? "passenger",
        }
      : {
          id: String(item.userId ?? "unknown"),
          name: "Unknown user",
          role: "passenger" as const,
        };
    return {
      id: String(item._id),
      source: "broadcast",
      title: item.title,
      body: item.body,
      message: item.body,
      createdAt: item.sentAt ?? item.createdAt ?? new Date(),
      recipient,
      isRead: Boolean(item.isRead),
      readAt: item.readAt?.toISOString?.() ?? null,
      seenAt: item.seenAt?.toISOString?.() ?? null,
      deliveredAt: item.deliveredAt?.toISOString?.() ?? null,
      status: getBroadcastStatus(item),
    };
  });

  return NextResponse.json({
    success: true,
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      unreadCount: await Notification.countDocuments({
        type: "admin_broadcast",
        isRead: false,
      }),
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  let body: {
    title?: string;
    message?: string;
    titleAr?: string;
    messageAr?: string;
    audience?: Audience;
    userIds?: string[];
    createdFrom?: string;
    createdTo?: string;
    icon?: string;
    style?: string;
    linkUrl?: string;
    linkLabel?: string;
    linkLabelAr?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const titleAr =
    typeof body.titleAr === "string" ? body.titleAr.trim().slice(0, 120) : "";
  const messageAr =
    typeof body.messageAr === "string"
      ? body.messageAr.trim().slice(0, 1000)
      : "";
  const audience = body.audience ?? "all";
  const icon = body.icon ?? "bell";
  const style = body.style ?? "info";
  const linkUrl = normalisePath(body.linkUrl);
  const linkLabel =
    typeof body.linkLabel === "string"
      ? body.linkLabel.trim().slice(0, 40)
      : "";
  const linkLabelAr =
    typeof body.linkLabelAr === "string"
      ? body.linkLabelAr.trim().slice(0, 40)
      : "";

  if (!title || title.length > 120) {
    return NextResponse.json(
      { error: "Title is required and must be 120 characters or fewer" },
      { status: 400 },
    );
  }
  if (!message || message.length > 1000) {
    return NextResponse.json(
      { error: "Message is required and must be 1000 characters or fewer" },
      { status: 400 },
    );
  }
  if (
    !["all", "passengers", "drivers", "created", "selected"].includes(audience)
  ) {
    return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
  }
  if (!ICONS.has(icon) || !STYLES.has(style)) {
    return NextResponse.json(
      { error: "Invalid notification customization" },
      { status: 400 },
    );
  }
  if (body.linkUrl && !linkUrl) {
    return NextResponse.json(
      { error: "Link must be an app path or a valid http(s) URL" },
      { status: 400 },
    );
  }
  if (linkUrl && !linkLabel) {
    return NextResponse.json(
      { error: "Link label is required when a link is provided" },
      { status: 400 },
    );
  }
  if (
    audience === "selected" &&
    (!Array.isArray(body.userIds) || body.userIds.length === 0)
  ) {
    return NextResponse.json(
      { error: "Select at least one recipient" },
      { status: 400 },
    );
  }

  const createdAtFilter: { $gte?: Date; $lte?: Date } = {};
  if (body.createdFrom) {
    const from = startOfDay(body.createdFrom);
    if (!from)
      return NextResponse.json(
        { error: "Invalid created-from date" },
        { status: 400 },
      );
    createdAtFilter.$gte = from;
  }
  if (body.createdTo) {
    const to = endOfDay(body.createdTo);
    if (!to)
      return NextResponse.json(
        { error: "Invalid created-to date" },
        { status: 400 },
      );
    createdAtFilter.$lte = to;
  }
  if (
    createdAtFilter.$gte &&
    createdAtFilter.$lte &&
    createdAtFilter.$gte > createdAtFilter.$lte
  ) {
    return NextResponse.json(
      { error: "Created-from date must be before created-to date" },
      { status: 400 },
    );
  }

  await connectDB();
  const userFilter: Record<string, unknown> = {
    role: { $in: ["passenger", "driver"] },
  };
  if (audience === "passengers") userFilter.role = "passenger";
  if (audience === "drivers") userFilter.role = "driver";
  if (audience === "selected") {
    const validIds = (body.userIds ?? [])
      .filter(isValidObjectId)
      .map((id) => new Types.ObjectId(id));
    if (validIds.length !== (body.userIds ?? []).length) {
      return NextResponse.json(
        { error: "One or more selected users are invalid" },
        { status: 400 },
      );
    }
    userFilter._id = { $in: validIds };
  }
  if (Object.keys(createdAtFilter).length > 0)
    userFilter.createdAt = createdAtFilter;

  const recipients = await User.find(userFilter).select("_id").lean();
  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "No users match the selected audience" },
      { status: 404 },
    );
  }

  const data = {
    icon,
    style,
    ...(linkUrl ? { linkUrl, linkLabel, linkLabelAr } : {}),
    deliveredBy: auth.userId,
  };
  const docs = recipients.map((recipient) => ({
    userId: recipient._id,
    type: "admin_broadcast",
    title,
    body: message,
    titleAr,
    bodyAr: messageAr,
    data,
    sentAt: new Date(),
    deliveryStatus: "delivered",
    deliveredAt: new Date(),
    seenAt: null,
    isRead: false,
    readAt: null,
  }));

  const inserted = await Notification.insertMany(docs);
  for (let offset = 0; offset < inserted.length; offset += 50) {
    await Promise.all(
      inserted
        .slice(offset, offset + 50)
        .map((notification) =>
          sendPushToUserNotification(String(notification._id)),
        ),
    );
  }
  return NextResponse.json(
    { success: true, sent: docs.length },
    { status: 201 },
  );
}
