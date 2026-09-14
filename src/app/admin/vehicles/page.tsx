import { redirect } from "next/navigation";
import { CarFront } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import VehiclesManager from "@/components/admin/VehiclesManager";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";

export const metadata = { title: "Vehicles - Commuter Admin" };

export default async function AdminVehiclesPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/login");
  return <AdminPageContainer><AdminPageHeader title="Vehicles" description="Manage pricing, capacity, availability, and region assignments." icon={CarFront} /><VehiclesManager /></AdminPageContainer>;
}
