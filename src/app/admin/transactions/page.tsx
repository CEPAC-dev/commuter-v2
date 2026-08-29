import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import TransactionsClient from "@/components/admin/transactions/TransactionsClient";

export const dynamic = "force-dynamic";

export default async function AdminTransactionsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "admin") redirect("/admin/login");

  await connectDB();
  const user = await User.findById(session.userId)
    .select("permissions role")
    .lean<{ role?: string; permissions?: string[] }>();
  const perms = user?.permissions ?? [];
  if (!hasPermission(user?.role, perms, PERMISSIONS.TRANSACTIONS_VIEW))
    redirect("/admin/dashboard");

  const canExport = hasPermission(
    user?.role,
    perms,
    PERMISSIONS.TRANSACTIONS_EXPORT,
  );
  const canRefund = hasPermission(
    user?.role,
    perms,
    PERMISSIONS.TRANSACTIONS_REFUND,
  );
  const canReports = hasPermission(
    user?.role,
    perms,
    PERMISSIONS.TRANSACTIONS_REPORTS,
  );

  return (
    <TransactionsClient
      canExport={canExport}
      canRefund={canRefund}
      canReports={canReports}
    />
  );
}
