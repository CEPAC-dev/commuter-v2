import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listDriverAvailability } from "@/lib/services/availability";
import { getProfile } from "@/lib/services/profile";
import AvailabilityClient from "./AvailabilityClient";

export const metadata = { title: "Availability — Commuter" };

export default async function AvailabilityPage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/availability");
  if (session.role === "admin") redirect("/admin/dashboard");
  if (session.role !== "driver") redirect("/my-trips");

  const [records, profile] = await Promise.all([
    listDriverAvailability(session.userId),
    getProfile(session.userId, session.role),
  ]);
  if (!profile || profile.role !== "driver") redirect("/login");

  return (
    <AvailabilityClient
      email={session.email}
      initialRecords={records}
      verificationStatus={profile.verificationStatus}
    />
  );
}
