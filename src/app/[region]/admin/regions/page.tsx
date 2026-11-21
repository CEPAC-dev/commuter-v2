import { notFound } from "next/navigation";
import RegionsManager from "@/components/admin/RegionsManager";
import { getRegionBySlug } from "@/lib/config/regions";

export default async function RegionsPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region: slug } = await params;
  const region = getRegionBySlug(slug);
  if (!region) notFound();
  return <RegionsManager regionCode={region.code} regionLabel={region.label} />;
}
