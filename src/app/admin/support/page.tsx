import { redirect } from "next/navigation";
import SupportCenter from "@/components/admin/SupportCenter";
import { getSession } from "@/lib/auth/session";

export default async function AdminSupportPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/signup");
  return <SupportCenter />;
}
