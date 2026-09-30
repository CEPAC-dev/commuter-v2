import "server-only";
import webPush from "web-push";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";
import { PushSubscription } from "@/models/PushSubscription";

let configurationState: "unchecked" | "valid" | "invalid" = "unchecked";

function configureWebPush() {
  if (configurationState === "valid") return true;
  if (configurationState === "invalid") return false;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  try {
    webPush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:support@commuter.site",
      publicKey,
      privateKey,
    );
    configurationState = "valid";
    return true;
  } catch (error) {
    configurationState = "invalid";
    console.error(
      "Web Push is disabled because VAPID configuration is invalid. Check VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

export function getVapidPublicKey() {
  return configureWebPush() ? (process.env.VAPID_PUBLIC_KEY ?? null) : null;
}

export async function sendPushPayloadToUser(
  userId: string,
  payload: {
    id: string;
    title: string;
    body: string;
    titleAr?: string;
    bodyAr?: string;
    data?: Record<string, unknown>;
    url?: string;
  },
) {
  if (!configureWebPush()) return;

  try {
    await connectDB();
    const subscriptions = await PushSubscription.find({ userId }).lean();
    if (!subscriptions.length) return;

    const serializedPayload = JSON.stringify(payload);

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              expirationTime: subscription.expirationTime ?? null,
              keys: subscription.keys,
            },
            serializedPayload,
            { TTL: 60 * 60 * 24 * 7 },
          );
        } catch (error) {
          const statusCode =
            typeof error === "object" && error !== null && "statusCode" in error
              ? Number((error as { statusCode?: unknown }).statusCode)
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            await PushSubscription.deleteOne({ _id: subscription._id });
          } else {
            console.error("Web Push delivery failed:", error);
          }
        }
      }),
    );
  } catch (error) {
    console.error("Could not dispatch Web Push notification:", error);
  }
}

export async function sendPushToUserNotification(notificationId: string) {
  try {
    await connectDB();
    const notification = await Notification.findById(notificationId).lean();
    if (!notification) return;
    await sendPushPayloadToUser(String(notification.userId), {
      id: String(notification._id),
      title: notification.title,
      body: notification.body,
      titleAr: notification.titleAr ?? "",
      bodyAr: notification.bodyAr ?? "",
      data: notification.data ?? {},
      url:
        typeof notification.data?.linkUrl === "string"
          ? notification.data.linkUrl
          : "/user/notifications",
    });
  } catch (error) {
    console.error("Could not load notification for Web Push:", error);
  }
}
