import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";

const RECIPIENT_ROLES = new Set(["passenger", "driver"]);
const ICONS = new Set(["bell", "info", "megaphone", "check", "alert"]);
const STYLES = new Set(["info", "success", "warning", "urgent"]);

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

export async function POST(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  let body: {
    title?: string;
    message?: string;
    audience?: Audience;
    userIds?: string[];
    createdFrom?: string;
    createdTo?: string;
    icon?: string;
    style?: string;
    linkUrl?: string;
    linkLabel?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const audience = body.audience ?? "all";
  const icon = body.icon ?? "bell";
  const style = body.style ?? "info";
  const linkUrl = normalisePath(body.linkUrl);
  const linkLabel =
    typeof body.linkLabel === "string"
      ? body.linkLabel.trim().slice(0, 40)
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
    ...(linkUrl ? { linkUrl, linkLabel } : {}),
    deliveredBy: auth.userId,
  };
  const docs = recipients.map((recipient) => ({
    userId: recipient._id,
    type: "admin_broadcast",
    title,
    body: message,
    data,
  }));

  await Notification.insertMany(docs);
  return NextResponse.json(
    { success: true, sent: docs.length },
    { status: 201 },
  );
}
