import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";
import { sendPushPayloadToUser } from "@/lib/notifications/webPush";

export interface CreateNotificationPayload {
  userId: string;
  type: string;
  title: string;
  body: string;
  titleAr?: string;
  bodyAr?: string;
  data?: Record<string, unknown>;
}

export async function createNotification(payload: CreateNotificationPayload) {
  if (!payload?.userId) return null;

  try {
    await connectDB();
    const doc = await Notification.create({
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      titleAr: payload.titleAr ?? "",
      bodyAr: payload.bodyAr ?? "",
      data: payload.data ?? {},
    });

    try {
      await sendPushPayloadToUser(String(doc.userId), {
        id: String(doc._id),
        title: doc.title,
        body: doc.body,
        titleAr: doc.titleAr ?? "",
        bodyAr: doc.bodyAr ?? "",
        data: doc.data ?? {},
        url:
          typeof doc.data?.linkUrl === "string"
            ? doc.data.linkUrl
            : "/user/notifications",
      });
    } catch (pushError) {
      console.error("Notification push failed; record was still created:", pushError);
    }

    return {
      id: String(doc._id),
      type: doc.type,
      title: doc.title,
      body: doc.body,
      data: doc.data ?? {},
      isRead: Boolean(doc.isRead),
      createdAt: doc.createdAt?.toISOString?.() ?? new Date().toISOString(),
    };
  } catch (error) {
    console.error("Could not create notification:", error);
    return null;
  }
}

export async function createNotifications(payloads: CreateNotificationPayload[]) {
  if (payloads.length === 0) return [];

  try {
    await connectDB();
    const docs = await Notification.insertMany(
      payloads.map((payload) => ({
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        titleAr: payload.titleAr ?? "",
        bodyAr: payload.bodyAr ?? "",
        data: payload.data ?? {},
      })),
    );
    return docs;
  } catch (error) {
    console.error("Could not create notifications:", error);
    return [];
  }
}
