import { redirect } from "next/navigation";
import { TicketPercent } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import PromoCodesManager from "@/components/admin/PromoCodesManager";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";

export const metadata = { title: "Promo codes - Commuter Admin" };

export default async function AdminPromoCodesPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/login");

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Promo codes"
        description="Create and track promo codes used at booking time."
        icon={TicketPercent}
      />
      <PromoCodesManager />
    </AdminPageContainer>
  );
}
