import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/services/profile";
import { normalizeRegion } from "@/lib/config/regions";
import CreateClient from "@/components/create/CreateClient";

export default async function CreatePage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/create");
  if (session.role === "admin") redirect("/admin/dashboard");
  const profile = await getProfile(session.userId, session.role);
  return (
    <CreateClient
      userEmail={session.email}
      region={normalizeRegion(profile?.region)}
    />
  );
}
