import { redirect } from "next/navigation";
import { MapPinned } from "lucide-react";
import StationsClient, {
  type AdminStationRow,
} from "@/components/admin/StationsClient";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Station } from "@/models/Station";

export default async function AdminStationsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/signup");

  await connectDB();
  const stationDocs = await Station.find().sort({ objectId: 1 }).lean<
    Array<{
      _id: unknown;
      objectId: number;
      name?: string;
      zones?: string;
      direction?: string;
      description?: string;
      lat: number;
      lng: number;
      active?: boolean;
    }>
  >();

  const stations: AdminStationRow[] = stationDocs.map((station) => ({
    id: String(station._id),
    stopNumber: station.objectId,
    name: station.name ?? "",
    zone: station.zones ?? "",
    direction: station.direction ?? "",
    description: station.description ?? "",
    lat: station.lat,
    lng: station.lng,
    active: station.active !== false,
  }));

  return (
    <AdminPageContainer maxWidth={1400}>
      <AdminPageHeader
        title="Stations"
        description={`${stations.length} station${stations.length === 1 ? "" : "s"}`}
        icon={MapPinned}
      />
      <StationsClient stations={stations} />
    </AdminPageContainer>
  );
}