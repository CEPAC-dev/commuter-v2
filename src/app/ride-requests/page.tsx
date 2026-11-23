import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import RideRequestsClient from "./RideRequestsClient";

export const metadata = { title: "Ride requests - Commuter" };
export const dynamic = "force-dynamic";

export default async function RideRequestsPage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/ride-requests");
  if (session.role === "admin") redirect("/admin/dashboard");
  if (session.role !== "driver") redirect("/my-trips");

  return <RideRequestsClient email={session.email} />;
}
