import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { resolveActiveRegion } from "@/lib/regions/resolveActiveRegion";

export default async function AdminOperationPage() {
  const session = await getSession();
  if (!session) redirect("/admin/signup");
  if (session.role !== "admin") redirect("/admin/signup");

  const region = await resolveActiveRegion({ userId: session.userId });
  redirect(`/${region.config.urlSlug}/admin/operation`);
}
