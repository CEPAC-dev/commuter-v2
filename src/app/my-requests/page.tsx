import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function MyRequestsRedirectPage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/my-trips");
  if (session.role === "admin") redirect("/admin/dashboard");
  redirect("/my-trips");
}