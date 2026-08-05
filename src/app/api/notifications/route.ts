import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = 12;

  await connectDB();
  const [items, total] = await Promise.all([
    Notification.find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Notification.countDocuments({ userId: session.userId }),
  ]);

  const data = items.map((item) => ({
    id: String(item._id),
    type: item.type,
    title: item.title,
    body: item.body,
    data: item.data ?? {},
    isRead: Boolean(item.isRead),
    readAt: item.readAt ? new Date(item.readAt).toISOString() : null,
    createdAt: new Date(item.createdAt).toISOString(),
  }));

  return NextResponse.json({
    success: true,
    data,
    meta: {
      currentPage: page,
      lastPage: Math.max(1, Math.ceil(total / pageSize)),
      total,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pathname } = new URL(req.url);
  const id = pathname.split("/").filter(Boolean).pop();
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await connectDB();
  await Notification.findOneAndUpdate(
    { _id: id, userId: session.userId },
    { isRead: true, readAt: new Date() },
  );

  return NextResponse.json({ success: true });
}
