import { Map } from "lucide-react";
import MapSettingsManager from "@/components/admin/MapSettingsManager";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";

export default function AdminMapsPage() {
  return <AdminPageContainer><AdminPageHeader title="Maps" description="Choose the map and search provider used by riders in each region." icon={Map} /><MapSettingsManager /></AdminPageContainer>;
}
