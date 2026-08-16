import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "Invalid notification id" },
      { status: 400 },
    );
  }

  await connectDB();
  const notification = await Notification.findOneAndUpdate(
    { _id: id, userId: session.userId },
    { isRead: true, readAt: new Date() },
    { new: true },
  );

  if (!notification) {
    return NextResponse.json(
      { error: "Notification not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
