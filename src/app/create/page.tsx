import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import CreateClient from "@/components/create/CreateClient";

export default async function CreatePage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/create");
  if (session.role === "admin") redirect("/admin/dashboard");
  return <CreateClient userEmail={session.email} />;
}
