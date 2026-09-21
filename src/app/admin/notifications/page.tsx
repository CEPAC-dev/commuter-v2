import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  NotificationTemplate,
} from "@/models/NotificationTemplate";
import NotificationCenter from "@/components/admin/NotificationCenter";
import LanguageToggle from "@/components/layout/LanguageToggle";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";
import { AdminTopbarActions } from "@/components/admin/layout/AdminShell";

export const dynamic = "force-dynamic";

async function ensureDefaultTemplates(userId: string) {
  await Promise.all(
    DEFAULT_NOTIFICATION_TEMPLATES.map((template) =>
      NotificationTemplate.updateOne(
        { createdBy: userId, name: template.name },
        { $setOnInsert: { ...template, createdBy: userId } },
        { upsert: true },
      ),
    ),
  );
}

export default async function AdminNotificationsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/signup");

  await connectDB();
  await ensureDefaultTemplates(session.userId);
  const [recipients, templates] = await Promise.all([
    User.find({ role: { $in: ["passenger", "driver"] } })
      .select("_id name email role createdAt")
      .sort({ name: 1 })
      .lean(),
    NotificationTemplate.find({ createdBy: session.userId })
      .sort({ createdAt: 1 })
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
          role: user.role as "passenger" | "driver",
          createdAt: user.createdAt.toISOString(),
        }))}
        initialTemplates={templates.map((template) => ({
          id: String(template._id),
          name: template.name,
          title: template.title,
          message: template.message,
          icon: template.icon,
          style: template.style,
          linkUrl: template.linkUrl ?? "",
          linkLabel: template.linkLabel ?? "",
        }))}
      />
    </AdminPageContainer>
  );
}
