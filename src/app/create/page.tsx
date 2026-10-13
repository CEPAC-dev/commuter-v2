import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/services/profile";
import { User } from "@/models/User";
import { normalizeRegion } from "@/lib/config/regions";
import { getMapSettings } from "@/lib/maps/settings";
import { isMultiDayRequestsEnabled } from "@/lib/config/featureFlags";
import CreateClient from "@/components/create/CreateClient";

export default async function CreatePage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/create");
  if (session.role === "admin") redirect("/admin/dashboard");
  const profile = await getProfile(session.userId, session.role);
  const userGender =
    session.role === "driver"
      ? ((await User.findById(session.userId)
          .select("gender")
          .lean<{ gender?: "male" | "female" | null } | null>())?.gender ??
        null)
      : (profile?.gender ?? null);
  const region = normalizeRegion(profile?.region);
  const mapSettings = await getMapSettings(region);
  return (
    <CreateClient
      userEmail={session.email}
      userName={profile?.name ?? ""}
      userGender={userGender}
      region={region}
      mapSettings={mapSettings}
      multiDayRequestsEnabled={isMultiDayRequestsEnabled(session.userId)}
    />
  );
}
