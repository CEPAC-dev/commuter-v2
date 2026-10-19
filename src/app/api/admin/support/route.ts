import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { getUnreadMessageCounts } from "@/lib/support/unread";
import { SupportConversation } from "@/models/SupportConversation";

const STATUSES = new Set(["all", "open", "waiting", "resolved"]);

export async function GET(request: Request) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const requestedStatus = new URL(request.url).searchParams.get("status") ?? "all";
  if (!STATUSES.has(requestedStatus)) {
    return NextResponse.json({ error: "Invalid conversation status." }, { status: 400 });
  }

  await connectDB();
  const filter =
    requestedStatus === "all" ? {} : { status: requestedStatus };
  const conversations = await SupportConversation.find(filter)
    .select(
      "_id contactName contactEmail category status lastMessage lastMessageAt createdAt customerLastReadAt adminLastReadAt",
    )
    .sort({ lastMessageAt: -1 })
    .lean();
  const unreadCounts = await getUnreadMessageCounts(conversations, "admin");

  return NextResponse.json({
    data: conversations.map((conversation) => ({
      id: String(conversation._id),
      contactName: conversation.contactName,
      contactEmail: conversation.contactEmail,
      category: conversation.category,
      status: conversation.status,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      unreadCount: unreadCounts.get(String(conversation._id)) ?? 0,
    })),
    unreadCount: [...unreadCounts.values()].reduce((total, count) => total + count, 0),
  });
}
