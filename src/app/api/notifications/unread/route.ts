import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const count = await Notification.countDocuments({
    userId: session.userId,
    isRead: false,
  });

  return NextResponse.json({ count });
}
