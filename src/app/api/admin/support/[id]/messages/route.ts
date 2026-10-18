import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { validateMutationRequest } from "@/lib/security/request";
import { SupportConversation } from "@/models/SupportConversation";
import { SupportMessage } from "@/models/SupportMessage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const invalidRequest = validateMutationRequest(request, { maxBytes: 5000 });
  if (invalidRequest) return invalidRequest;
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid conversation id." }, { status: 400 });
  }

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
  const conversation = await SupportConversation.findById(id).select("_id status");
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const message = await SupportMessage.create({
    conversationId: conversation._id,
    senderId: auth.userId,
    senderRole: "admin",
    text,
  });
  await SupportConversation.updateOne(
    { _id: conversation._id },
    {
      $set: {
        status: "waiting",
        lastMessage: text.slice(0, 240),
        lastMessageAt: message.createdAt,
      },
    },
  );
  if (conversation.status !== "waiting") {
    const notice = await SupportMessage.create({
      conversationId: conversation._id,
      senderId: auth.userId,
      senderRole: "admin",
      eventType: "status_change",
      status: "waiting",
      text: "Support status changed: Waiting for customer.",
    });
    await SupportConversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessage: notice.text,
          lastMessageAt: notice.createdAt,
        },
      },
    );
  }

  return NextResponse.json(
    {
      data: {
        id: String(message._id),
        senderRole: message.senderRole,
        text: message.text,
        createdAt: message.createdAt,
      },
    },
    { status: 201 },
  );
}
