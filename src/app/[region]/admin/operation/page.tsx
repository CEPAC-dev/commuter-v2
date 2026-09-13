import { notFound } from "next/navigation";
import OperationConsole from "@/components/admin/OperationConsole";
import StationOperations from "@/components/admin/StationOperations";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";
import { getRegionBySlug } from "@/lib/config/regions";

export default async function RegionalAdminOperationPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region: slug } = await params;
  const region = getRegionBySlug(slug);
  if (!region) notFound();

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Operation tools"
        description={`Manage operations for ${region.label}.`}
      />
      <StationOperations regionCode={region.code} />
      <OperationConsole regionCode={region.code} />
    </AdminPageContainer>
  );
}
