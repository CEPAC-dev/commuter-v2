import { notFound } from "next/navigation";
import StationManagement from "@/components/admin/StationManagement";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";
import { getRegionBySlug } from "@/lib/config/regions";
export default async function StationsPage({ params }: { params: Promise<{ region: string }> }) { const { region: slug } = await params; const region = getRegionBySlug(slug); if (!region) notFound(); return <AdminPageContainer><AdminPageHeader title="Stations" description={`Manage stations for ${region.label}.`} /><StationManagement regionCode={region.code} /></AdminPageContainer>; }
