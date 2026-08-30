import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import OperationConsole from "@/components/admin/OperationConsole";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";

export default async function AdminOperationPage() {
  const session = await getSession();
  if (!session) redirect("/admin/signup");
  if (session.role !== "admin") redirect("/admin/signup");

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Operation tools"
        description="Run operational APIs from one place and review their output before moving on."
      />
      <OperationConsole />
    </AdminPageContainer>
  );
}
