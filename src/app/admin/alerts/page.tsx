import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import AdminActivityFeed from "@/components/admin/AdminActivityFeed";

export const dynamic = "force-dynamic";

export default async function AdminAlertsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/signup");
  return <AdminActivityFeed />;
}
