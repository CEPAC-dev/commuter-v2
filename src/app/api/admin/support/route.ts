import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { validateMutationRequest } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { isSupportCategory } from "@/lib/support/decisionTree";
import { getUnreadMessageCounts } from "@/lib/support/unread";
import { SupportConversation } from "@/models/SupportConversation";
import { SupportMessage } from "@/models/SupportMessage";
import { User } from "@/models/User";

const STATUSES = new Set(["all", "open", "waiting", "resolved"]);

export async function GET(request: Request) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const requestedStatus =
    new URL(request.url).searchParams.get("status") ?? "all";
  if (!STATUSES.has(requestedStatus)) {
    return NextResponse.json(
      { error: "Invalid conversation status." },
      { status: 400 },
    );
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
    unreadCount: [...unreadCounts.values()].reduce(
      (total, count) => total + count,
      0,
    ),
  });
}

export async function POST(request: NextRequest) {
  const invalidRequest = validateMutationRequest(request, { maxBytes: 5000 });
  if (invalidRequest) return invalidRequest;
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const limited = await enforceRateLimit(
    request,
    "admin-support-conversation-create",
    { limit: 20, windowMs: 15 * 60 * 1000 },
  );
  if (limited) return limited;

  let body: { userId?: unknown; category?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (
    typeof body.userId !== "string" ||
    !Types.ObjectId.isValid(body.userId) ||
    !isSupportCategory(body.category) ||
    !message ||
    message.length > 2000
  ) {
    return NextResponse.json(
      { error: "Choose a user, category, and message under 2,000 characters." },
      { status: 400 },
    );
  }

  await connectDB();
  const user = await User.findOne({
    _id: body.userId,
    role: { $in: ["passenger", "driver"] },
  })
    .select("_id name email")
    .lean<{ _id: Types.ObjectId; name: string; email?: string } | null>();
  if (!user)
    return NextResponse.json({ error: "User not found." }, { status: 404 });

  const conversation = await SupportConversation.create({
    userId: user._id,
    contactName: user.name,
    contactEmail: user.email ?? "",
    category: body.category,
    status: "waiting",
    lastMessage: message.slice(0, 240),
    lastMessageAt: new Date(),
  });
  try {
    await SupportMessage.create({
      conversationId: conversation._id,
      senderId: auth.userId,
      senderRole: "admin",
      text: message,
    });
  } catch (error) {
    await SupportConversation.deleteOne({ _id: conversation._id });
    throw error;
  }

  return NextResponse.json(
    {
      data: {
        id: String(conversation._id),
        contactName: conversation.contactName,
        category: conversation.category,
        status: conversation.status,
      },
    },
    { status: 201 },
  );
}
