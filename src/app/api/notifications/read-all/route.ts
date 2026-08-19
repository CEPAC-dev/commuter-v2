import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const result = await Notification.updateMany(
    { userId: session.userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );

  return NextResponse.json({ ok: true, updatedCount: result.modifiedCount });
}
