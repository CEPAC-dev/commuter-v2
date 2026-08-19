import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pageParam = Number.parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  await connectDB();
  const filter = { userId: session.userId };
  const [items, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Notification.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: items.map((item) => ({
      id: String(item._id),
      type: item.type,
      title: item.title,
      body: item.body,
      data: item.data ?? {},
      isRead: Boolean(item.isRead),
      readAt: item.readAt?.toISOString?.() ?? null,
      createdAt: item.createdAt?.toISOString?.() ?? new Date().toISOString(),
    })),
    meta: {
      currentPage: page,
      lastPage: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
    },
  });
}
