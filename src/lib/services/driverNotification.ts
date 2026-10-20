import { AdminActivityNotification } from "@/models/AdminActivityNotification";
import { User } from "@/models/User";

export async function notifyAdminsDriverUpdate(
  driverId: string,
  driverName: string,
  isFirstSubmit: boolean
) {
  try {
    // Get all admins
    const admins = await User.find({ role: "admin" }).select("_id").lean();
    if (!admins.length) return;

    const eventType = isFirstSubmit
      ? "driver_verification_submitted"
      : "driver_verification_updated";

    const title = isFirstSubmit
      ? "New driver verification submitted"
      : "Driver verification updated";

    const body = isFirstSubmit
      ? `${driverName} has submitted their profile for verification.`
      : `${driverName} has updated their verification documents and is under review again.`;

    const dedupeKey = `${eventType}:${driverId}:${Date.now()}`;

    // Create notification for each admin
    const notifications = admins.map((admin) => ({
      adminId: admin._id,
      eventType,
      dedupeKey,
      title,
      body,
      data: { driverId, driverName },
      isRead: false,
    }));

    await AdminActivityNotification.insertMany(notifications, { ordered: false });
  } catch (err) {
    console.error("Failed to notify admins:", err);
  }
}
