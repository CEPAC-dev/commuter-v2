import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { AdminActivityNotification } from "@/models/AdminActivityNotification";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const pageParam = Number.parseInt(
    req.nextUrl.searchParams.get("page") ?? "1",
    10,
  );
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const filter: Record<string, unknown> = { adminId: auth.userId };

  if (query) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchConditions: Record<string, unknown>[] = [
      { title: { $regex: escaped, $options: "i" } },
      { body: { $regex: escaped, $options: "i" } },
      { "data.userName": { $regex: escaped, $options: "i" } },
      { "data.phone": { $regex: escaped, $options: "i" } },
      { "data.email": { $regex: escaped, $options: "i" } },
    ];
    if (/^\d+$/.test(query)) {
      searchConditions.push(
        { "data.userNumber": Number(query) },
        { "data.tripNumber": Number(query) },
      );
    }
    filter.$or = searchConditions;
  }

  const [items, total, unreadCount] = await Promise.all([
    AdminActivityNotification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    AdminActivityNotification.countDocuments(filter),
    AdminActivityNotification.countDocuments({
      adminId: auth.userId,
      isRead: false,
    }),
  ]);

  return NextResponse.json({
    data: items.map((item) => ({
      id: String(item._id),
      eventType: item.eventType,
      title: item.title,
      body: item.body,
      data: item.data ?? {},
      isRead: Boolean(item.isRead),
      createdAt: item.createdAt?.toISOString?.() ?? new Date().toISOString(),
    })),
    meta: {
      page,
      pageSize: PAGE_SIZE,
      total,
      unreadCount,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  let body: { id?: string; markAll?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.markAll) {
    await AdminActivityNotification.updateMany(
      { adminId: auth.userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    return NextResponse.json({ success: true });
  }

  if (!body.id || !isValidObjectId(body.id)) {
    return NextResponse.json(
      { error: "Invalid notification id" },
      { status: 400 },
    );
  }
  const result = await AdminActivityNotification.findOneAndUpdate(
    { _id: body.id, adminId: auth.userId },
    { $set: { isRead: true, readAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!result)
    return NextResponse.json(
      { error: "Notification not found" },
      { status: 404 },
    );
  return NextResponse.json({ success: true });
}
