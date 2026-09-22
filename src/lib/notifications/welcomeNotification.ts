import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";

export async function createWelcomeNotification(userId: string) {
  try {
    await connectDB();
    await Notification.create({
      userId,
      type: "admin_broadcast",
      title: "Welcome to Commuter",
      body: "Your easier daily commute starts here. Book your first ride and move through Cairo with confidence.",
      titleAr: "أهلاً بك في Commuter",
      bodyAr:
        "رحلتك اليومية الأسهل تبدأ من هنا. احجز أول مشوار لك وتنقّل في القاهرة براحة وثقة.",
      data: {
        icon: "check",
        style: "success",
        linkUrl: "/create",
        linkLabel: "Book your first ride",
        linkLabelAr: "احجز أول مشوار",
      },
    });
  } catch (error) {
    // Registration must succeed even if notification delivery is temporarily unavailable.
    console.error("Welcome notification creation failed:", error);
  }
}
