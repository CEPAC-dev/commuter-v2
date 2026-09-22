import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { NotificationTemplate } from "@/models/NotificationTemplate";
import { ensureDefaultNotificationTemplates } from "@/lib/notifications/ensureDefaultTemplates";

function serialize(item: Record<string, unknown>) {
  return {
    id: String(item._id),
    name: item.name,
    title: item.title,
    message: item.message,
    titleAr: item.titleAr ?? "",
    messageAr: item.messageAr ?? "",
    icon: item.icon,
    style: item.style,
    linkUrl: item.linkUrl ?? "",
    linkLabel: item.linkLabel ?? "",
    linkLabelAr: item.linkLabelAr ?? "",
  };
}

export async function GET() {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  await connectDB();
  await ensureDefaultNotificationTemplates(auth.userId);
  const templates = await NotificationTemplate.find({ createdBy: auth.userId })
    .sort({ createdAt: 1 })
    .lean();
  return NextResponse.json({ data: templates.map((item) => serialize(item)) });
}

export async function POST(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fields = ["name", "title", "message"] as const;
  for (const field of fields) {
    if (typeof body[field] !== "string" || !String(body[field]).trim()) {
      return NextResponse.json(
        { error: `${field} is required` },
        { status: 400 },
      );
    }
  }

  await connectDB();
  try {
    const template = await NotificationTemplate.create({
      createdBy: auth.userId,
      name: String(body.name).trim().slice(0, 80),
      title: String(body.title).trim().slice(0, 120),
      message: String(body.message).trim().slice(0, 1000),
      titleAr:
        typeof body.titleAr === "string"
          ? body.titleAr.trim().slice(0, 120)
          : "",
      messageAr:
        typeof body.messageAr === "string"
          ? body.messageAr.trim().slice(0, 1000)
          : "",
      icon: typeof body.icon === "string" ? body.icon : "bell",
      style: typeof body.style === "string" ? body.style : "info",
      linkUrl:
        typeof body.linkUrl === "string"
          ? body.linkUrl.trim().slice(0, 300)
          : "",
      linkLabel:
        typeof body.linkLabel === "string"
          ? body.linkLabel.trim().slice(0, 40)
          : "",
      linkLabelAr:
        typeof body.linkLabelAr === "string"
          ? body.linkLabelAr.trim().slice(0, 40)
          : "",
    });
    return NextResponse.json(
      { data: serialize(template.toObject()) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000) {
      return NextResponse.json(
        { error: "A template with this name already exists" },
        { status: 409 },
      );
    }
    throw error;
  }
}
