import { notFound } from "next/navigation";
import StationSuggestionsClient from "@/components/admin/StationSuggestionsClient";
import { getRegionBySlug } from "@/lib/config/regions";

export default async function StationSuggestionsPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region: slug } = await params;
  const region = getRegionBySlug(slug);
  if (!region) notFound();

  return <StationSuggestionsClient regionCode={region.code} />;
}
