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

const STATUSES = new Set(["open", "waiting", "resolved"]);

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid conversation id." }, { status: 400 });
  }

  await connectDB();
  const conversation = await SupportConversation.findById(id)
    .select(
      "_id contactName contactEmail category status lastMessage lastMessageAt createdAt customerLastReadAt",
    )
    .lean();
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const messages = await SupportMessage.find({ conversationId: conversation._id })
    .sort({ createdAt: -1 })
    .lean();
  const latestCustomerMessage = messages.find(
    (message) => message.senderRole === "customer",
  );
  if (latestCustomerMessage) {
    await SupportConversation.updateOne(
      { _id: conversation._id },
      { $max: { adminLastReadAt: latestCustomerMessage.createdAt } },
    );
  }
  const customerLastReadAt = conversation.customerLastReadAt?.getTime() ?? 0;

  return NextResponse.json({
    data: {
      conversation: {
        id: String(conversation._id),
        contactName: conversation.contactName,
        contactEmail: conversation.contactEmail,
        category: conversation.category,
        status: conversation.status,
        createdAt: conversation.createdAt,
      },
      messages: messages.reverse().map((message) => ({
        id: String(message._id),
        senderRole: message.senderRole,
        eventType: message.eventType,
        status: message.status,
        text: message.text,
        createdAt: message.createdAt,
        isRead:
          message.senderRole === "admin" &&
          message.createdAt.getTime() <= customerLastReadAt,
      })),
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid conversation id." }, { status: 400 });
  }

  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.status !== "string" || !STATUSES.has(body.status)) {
    return NextResponse.json({ error: "Invalid conversation status." }, { status: 400 });
  }

  await connectDB();
  const current = await SupportConversation.findById(id).select("_id status");
  if (!current) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (current.status !== body.status) {
    const status = body.status as "open" | "waiting" | "resolved";
    const statusLabel = {
      open: "Needs reply",
      waiting: "Waiting for customer",
      resolved: "Resolved",
    }[status];
    const notice = await SupportMessage.create({
      conversationId: current._id,
      senderId: auth.userId,
      senderRole: "admin",
      eventType: "status_change",
      status,
      text: `Support status changed: ${statusLabel}.`,
    });
    await SupportConversation.updateOne(
      { _id: current._id },
      {
        $set: {
          status,
          lastMessage: notice.text,
          lastMessageAt: notice.createdAt,
        },
      },
    );
  }

  const conversation = await SupportConversation.findById(id)
    .select("_id status")
    .lean();
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  return NextResponse.json({
    data: { id: String(conversation._id), status: conversation.status },
  });
}
