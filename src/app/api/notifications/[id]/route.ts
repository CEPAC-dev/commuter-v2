import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  await connectDB();
  const notification = await Notification.findOneAndUpdate(
    { _id: id, userId: session.userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true },
  ).lean();

  if (!notification) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
