import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { validateMutationRequest } from "@/lib/security/request";
import { isSupportCategory } from "@/lib/support/decisionTree";
import { getUnreadMessageCounts } from "@/lib/support/unread";
import { SupportConversation } from "@/models/SupportConversation";
import { SupportMessage } from "@/models/SupportMessage";
import { User } from "@/models/User";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const session = await getSession();
  if (session?.role === "admin") {
    return NextResponse.json({ error: "Customer account required." }, { status: 403 });
  }

  if (!session) {
    return NextResponse.json({
      mode: "guest",
      customer: null,
      data: [],
    });
  }

  await connectDB();
  const user = await User.findById(session.userId)
    .select("_id name email")
    .lean<{ _id: Types.ObjectId; name: string; email?: string } | null>();
  if (!user) {
    return NextResponse.json({ error: "Session user not found." }, { status: 401 });
  }

  const conversations = await SupportConversation.find({ userId: user._id })
    .select(
      "_id category status lastMessage lastMessageAt createdAt customerLastReadAt adminLastReadAt",
    )
    .sort({ lastMessageAt: -1 })
    .lean();
  const unreadCounts = await getUnreadMessageCounts(conversations, "customer");

  return NextResponse.json({
    mode: "user",
    customer: { name: user.name, email: user.email ?? session.email },
    data: conversations.map((conversation) => ({
      id: String(conversation._id),
      category: conversation.category,
      status: conversation.status,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      unreadCount: unreadCounts.get(String(conversation._id)) ?? 0,
      accessToken: null,
    })),
    unreadCount: [...unreadCounts.values()].reduce((total, count) => total + count, 0),
  });
}

export async function POST(request: NextRequest) {
  const invalidRequest = validateMutationRequest(request, { maxBytes: 5000 });
  if (invalidRequest) return invalidRequest;
  const limited = await enforceRateLimit(request, "support-conversation-create", {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  const session = await getSession();
  if (session?.role === "admin") {
    return NextResponse.json({ error: "Customer account required." }, { status: 403 });
  }

  let body: {
    category?: unknown;
    contactName?: unknown;
    contactEmail?: unknown;
    message?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  let contactName =
    typeof body.contactName === "string" ? body.contactName.trim() : "";
  let contactEmail =
    typeof body.contactEmail === "string"
      ? body.contactEmail.trim().toLowerCase()
      : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (
    !isSupportCategory(body.category) ||
    contactName.length < 2 ||
    contactName.length > 100 ||
    !EMAIL_PATTERN.test(contactEmail) ||
    contactEmail.length > 254 ||
    !message ||
    message.length > 2000
  ) {
    return NextResponse.json(
      { error: "Enter your name, a valid email, and a message under 2,000 characters." },
      { status: 400 },
    );
  }

  await connectDB();

  let userId: Types.ObjectId | null = null;
  if (session) {
    const user = await User.findById(session.userId)
      .select("_id name email")
      .lean<{ _id: Types.ObjectId; name: string; email?: string } | null>();
    if (!user) {
      return NextResponse.json({ error: "Session user not found." }, { status: 401 });
    }
    userId = user._id;
    contactName = user.name;
    contactEmail = user.email ?? session.email;
  }

  const guestToken = session ? null : randomBytes(32).toString("hex");
  const conversation = await SupportConversation.create({
    userId,
    contactName,
    contactEmail,
    category: body.category,
    status: "open",
    lastMessage: message.slice(0, 240),
    lastMessageAt: new Date(),
    guestAccessTokenHash: guestToken
      ? createHash("sha256").update(guestToken).digest("hex")
      : null,
  });
  try {
    await SupportMessage.create({
      conversationId: conversation._id,
      senderId: userId,
      senderRole: "customer",
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
        accessToken: guestToken,
        status: conversation.status,
      },
    },
    { status: 201 },
  );
}
