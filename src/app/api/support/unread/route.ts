import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { getUnreadMessageCounts } from "@/lib/support/unread";
import { SupportConversation } from "@/models/SupportConversation";

export async function GET(request: Request) {
  const session = await getSession();
  if (session?.role === "admin") {
    return NextResponse.json({ error: "Customer account required." }, { status: 403 });
  }
  await connectDB();

  if (session) {
    const conversations = await SupportConversation.find({ userId: session.userId })
      .select("_id customerLastReadAt")
      .lean();
    const unreadCounts = await getUnreadMessageCounts(conversations, "customer");
    return NextResponse.json({
      unreadCount: [...unreadCounts.values()].reduce((total, count) => total + count, 0),
    });
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");
  const token = request.headers.get("x-support-access-token");
  if (!conversationId && !token) return NextResponse.json({ unreadCount: 0 });
  if (!conversationId || !Types.ObjectId.isValid(conversationId) || !token) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const conversation = await SupportConversation.findById(conversationId)
    .select("+guestAccessTokenHash customerLastReadAt")
    .lean();
  if (
    !conversation ||
    conversation.userId ||
    !conversation.guestAccessTokenHash
  ) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  const actual = createHash("sha256").update(token).digest();
  const expected = Buffer.from(conversation.guestAccessTokenHash, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const unreadCounts = await getUnreadMessageCounts([conversation], "customer");
  return NextResponse.json({
    unreadCount: unreadCounts.get(String(conversation._id)) ?? 0,
  });
}
