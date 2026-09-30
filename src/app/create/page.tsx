import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/services/profile";
import { normalizeRegion } from "@/lib/config/regions";
import { getMapSettings } from "@/lib/maps/settings";
import CreateClient from "@/components/create/CreateClient";

export default async function CreatePage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/create");
  if (session.role === "admin") redirect("/admin/dashboard");
  const profile = await getProfile(session.userId, session.role);
  const region = normalizeRegion(profile?.region);
  const mapSettings = await getMapSettings(region);
  return (
    <CreateClient
      userEmail={session.email}
      region={region}
      mapSettings={mapSettings}
    />
  );
}
