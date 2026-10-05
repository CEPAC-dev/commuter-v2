import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";
import WaitingListClient from "@/components/admin/WaitingListClient";

export const dynamic = "force-dynamic";

export default async function AdminWaitingListPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/login");

  const locale = await getServerLocale();
  return (
    <AdminPageContainer maxWidth={1180}>
      <AdminPageHeader
        title={translate(locale, "admin.waiting_list.title")}
        description={translate(locale, "admin.waiting_list.description")}
        icon={ClipboardList}
      />
      <WaitingListClient />
    </AdminPageContainer>
  );
}
