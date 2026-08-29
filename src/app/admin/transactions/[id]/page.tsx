import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import TransactionDetailClient from "@/components/admin/transactions/TransactionDetailClient";

export const dynamic = "force-dynamic";

export default async function AdminTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "admin") redirect("/admin/login");

  await connectDB();
  const user = await User.findById(session.userId)
    .select("permissions role")
    .lean<{ role?: string; permissions?: string[] }>();
  const perms = user?.permissions ?? [];
  if (!hasPermission(user?.role, perms, PERMISSIONS.TRANSACTIONS_DETAILS))
    redirect("/admin/dashboard");

  const canRefund = hasPermission(
    user?.role,
    perms,
    PERMISSIONS.TRANSACTIONS_REFUND,
  );
  const { id } = await params;
  return <TransactionDetailClient id={id} canRefund={canRefund} />;
}
