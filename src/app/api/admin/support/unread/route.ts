import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { getUnreadMessageCounts } from "@/lib/support/unread";
import { SupportConversation } from "@/models/SupportConversation";

export async function GET() {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  await connectDB();

  const conversations = await SupportConversation.find({})
    .select("_id adminLastReadAt")
    .lean();
  const unreadCounts = await getUnreadMessageCounts(conversations, "admin");
  return NextResponse.json({
    unreadCount: [...unreadCounts.values()].reduce((total, count) => total + count, 0),
  });
}
