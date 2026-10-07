import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { NotificationTemplate } from "@/models/NotificationTemplate";
import { ensureDefaultNotificationTemplates } from "@/lib/notifications/ensureDefaultTemplates";
import NotificationCenter from "@/components/admin/NotificationCenter";
import LanguageToggle from "@/components/layout/LanguageToggle";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";
import { AdminTopbarActions } from "@/components/admin/layout/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/signup");

  await connectDB();
  await ensureDefaultNotificationTemplates(session.userId);
  const [recipients, templates, broadcasts] = await Promise.all([
    User.find({ role: { $in: ["passenger", "driver"] } })
      .select("_id name email phone role createdAt")
      .sort({ name: 1 })
      .lean(),
    NotificationTemplate.find({ createdBy: session.userId })
      .sort({ createdAt: 1 })
      .lean(),
    Notification.find({ type: "admin_broadcast" })
      .populate("userId", "name email phone role")
      .sort({ sentAt: -1, createdAt: -1 })
      .limit(12)
      .lean(),
  ]);

  return (
    <AdminPageContainer maxWidth={1180}>
      <AdminPageHeader
        title="Notification center"
        description="Create reusable messages and send targeted in-app notifications."
        icon={Bell}
      />
      <AdminTopbarActions>
        <LanguageToggle />
      </AdminTopbarActions>
      <NotificationCenter
        recipients={recipients.map((user) => ({
          id: String(user._id),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role as "passenger" | "driver",
          createdAt: user.createdAt.toISOString(),
        }))}
        initialTemplates={templates.map((template) => ({
          id: String(template._id),
          name: template.name,
          title: template.title,
          message: template.message,
          titleAr: template.titleAr ?? "",
          messageAr: template.messageAr ?? "",
          icon: template.icon,
          style: template.style,
          linkUrl: template.linkUrl ?? "",
          linkLabel: template.linkLabel ?? "",
          linkLabelAr: template.linkLabelAr ?? "",
        }))}
        initialBroadcasts={broadcasts.map((notification) => {
          const user = notification.userId as
            | {
                _id?: unknown;
                name?: string;
                role?: string;
                email?: string;
                phone?: string;
              }
            | undefined;
          const recipient: {
            id: string;
            name: string;
            email?: string;
            phone?: string;
            role: "passenger" | "driver";
          } = user
            ? {
                id: String(user._id ?? notification.userId),
                name: user.name ?? "Unknown user",
                email: user.email,
                phone: user.phone,
                role:
                  user.role === "passenger" || user.role === "driver"
                    ? (user.role as "passenger" | "driver")
                    : "passenger",
              }
            : {
                id: String(notification.userId ?? "unknown"),
                name: "Unknown user",
                role: "passenger",
              };
          return {
            id: String(notification._id),
            title: notification.title,
            body: notification.body,
            source: "broadcast" as const,
            createdAt: (
              notification.sentAt ??
              notification.createdAt ??
              new Date()
            ).toISOString(),
            recipient,
            status: (notification.isRead
              ? "read"
              : notification.seenAt
                ? "seen"
                : notification.deliveredAt
                  ? "delivered"
                  : "pending") as "pending" | "delivered" | "seen" | "read",
            deliveredAt: notification.deliveredAt?.toISOString?.() ?? null,
            seenAt: notification.seenAt?.toISOString?.() ?? null,
            readAt: notification.readAt?.toISOString?.() ?? null,
          };
        })}
      />
    </AdminPageContainer>
  );
}
