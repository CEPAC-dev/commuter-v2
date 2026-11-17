import { redirect } from "next/navigation";
import AdminProfileForm from "@/components/admin/profile/AdminProfileForm";
import {
  AdminPageContainer,
  AdminPageHeader,
} from "@/components/admin/layout";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { getActiveVerificationMethod } from "@/lib/auth/securityQuestion";
import { getSecurityQuestion } from "@/lib/config/verification";

export default async function AdminProfilePage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/login");

  await connectDB();
  const [admin, verificationMethod] = await Promise.all([
    User.findOne({ _id: session.userId, role: "admin" })
      .select("name email phone securityQuestionId +securityAnswerHash")
      .lean<{
        name?: string;
        email?: string;
        phone?: string;
        securityQuestionId?: string | null;
        securityAnswerHash?: string | null;
      }>(),
    getActiveVerificationMethod(),
  ]);
  if (!admin) redirect("/admin/login");
  const securityQuestion = admin.securityQuestionId
    ? getSecurityQuestion(admin.securityQuestionId)
    : null;
  const hasSecurityQuestion = Boolean(
    securityQuestion && admin.securityAnswerHash,
  );

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Profile"
        description="View and manage your admin account information."
      />
      <AdminProfileForm
        initialProfile={{
          name: admin.name ?? "",
          email: admin.email ?? "",
          phone: admin.phone ?? "",
        }}
        verificationMethod={verificationMethod}
        securityQuestion={hasSecurityQuestion ? securityQuestion?.question ?? null : null}
        hasSecurityQuestion={hasSecurityQuestion}
      />
    </AdminPageContainer>
  );
}
