import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { validateMutationRequest } from "@/lib/security/request";
import { SupportConversation } from "@/models/SupportConversation";
import { SupportMessage } from "@/models/SupportMessage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type ConversationAccess = {
  _id: Types.ObjectId;
  userId: Types.ObjectId | null;
  guestAccessTokenHash?: string | null;
  status: string;
  adminLastReadAt?: Date | null;
};

async function loadAccessibleConversation(
  id: string,
  request: Request,
): Promise<{ conversation: ConversationAccess; userId: string | null } | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const session = await getSession();
  if (session?.role === "admin") return null;
  const conversation = await SupportConversation.findById(id)
    .select("+guestAccessTokenHash")
    .lean<ConversationAccess | null>();
  if (!conversation) return null;

  if (session && String(conversation.userId) === session.userId) {
    return { conversation, userId: session.userId };
  }

  const token = request.headers.get("x-support-access-token");
  if (
    !session &&
    !conversation.userId &&
    token &&
    conversation.guestAccessTokenHash
  ) {
    const actual = createHash("sha256").update(token).digest();
    const expected = Buffer.from(conversation.guestAccessTokenHash, "hex");
    if (expected.length === actual.length && timingSafeEqual(actual, expected)) {
      return { conversation, userId: null };
    }
  }
  return null;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  await connectDB();
  const access = await loadAccessibleConversation(id, request);
  if (!access) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const messages = await SupportMessage.find({
    conversationId: access.conversation._id,
  })
    .sort({ createdAt: -1 })
    .lean();
  const latestSupportMessage = messages.find(
    (message) => message.senderRole === "admin" || message.senderRole === "system",
  );
  if (latestSupportMessage) {
    await SupportConversation.updateOne(
      { _id: access.conversation._id },
      { $max: { customerLastReadAt: latestSupportMessage.createdAt } },
    );
  }
  const adminLastReadAt =
    access.conversation.adminLastReadAt?.getTime() ?? 0;

  return NextResponse.json({
    data: messages.reverse().map((message) => ({
      id: String(message._id),
      senderRole: message.senderRole,
      eventType: message.eventType,
      status: message.status,
      text: message.text,
      createdAt: message.createdAt,
      isRead:
        message.senderRole === "customer" &&
        message.createdAt.getTime() <= adminLastReadAt,
    })),
  });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const invalidRequest = validateMutationRequest(request, { maxBytes: 5000 });
  if (invalidRequest) return invalidRequest;
  const limited = await enforceRateLimit(request, "support-customer-message", {
    limit: 60,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  const { id } = await params;
  let body: { text?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 2000) {
    return NextResponse.json(
      { error: "Message must be between 1 and 2,000 characters." },
      { status: 400 },
    );
  }

  await connectDB();
  const access = await loadAccessibleConversation(id, request);
  if (!access) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const created = await SupportMessage.create({
    conversationId: access.conversation._id,
    senderId: access.userId,
    senderRole: "customer",
    text,
  });
  await SupportConversation.updateOne(
    { _id: access.conversation._id },
    {
      $set: {
        status: "open",
        lastMessage: text.slice(0, 240),
        lastMessageAt: created.createdAt,
      },
    },
  );

  return NextResponse.json(
    {
      data: {
        id: String(created._id),
        senderRole: created.senderRole,
        text: created.text,
        createdAt: created.createdAt,
      },
    },
    { status: 201 },
  );
}
