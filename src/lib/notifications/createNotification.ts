import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";

export interface CreateNotificationPayload {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function createNotification(payload: CreateNotificationPayload) {
  if (!payload?.userId) return null;

  await connectDB();
  const doc = await Notification.create({
    userId: payload.userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  });

  return {
    id: String(doc._id),
    type: doc.type,
    title: doc.title,
    body: doc.body,
    data: doc.data ?? {},
    isRead: Boolean(doc.isRead),
    createdAt: doc.createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}
