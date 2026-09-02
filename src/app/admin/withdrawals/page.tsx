import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Banknote } from "lucide-react";
import WithdrawalQueueClient from "@/components/admin/WithdrawalQueueClient";
import {
  AdminPageContainer,
  AdminPageHeader,
} from "@/components/admin/layout";

export default async function AdminWithdrawalsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Withdrawal requests"
        description="Review driver wallet state, approve payouts, or reject held withdrawals with a reason."
        icon={Banknote}
      />
      <WithdrawalQueueClient />
    </AdminPageContainer>
  );
}
