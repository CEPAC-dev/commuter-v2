import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import AdminShell from "@/components/admin/layout/AdminShell";
import { getSession } from "@/lib/auth/session";
import { REGIONS, type RegionCode } from "@/lib/config/regions";
import {
  RegionAccessError,
  resolveActiveRegion,
} from "@/lib/regions/resolveActiveRegion";
import { getAdminIdentity } from "@/lib/admin/getAdminIdentity";
import { getOperatingCities } from "@/lib/regions/cities";

export default async function RegionalAdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ region: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "admin") redirect("/");

  const { region: requestedRegion } = await params;
  let activeRegion;
  try {
    activeRegion = await resolveActiveRegion({
      userId: session.userId,
      requested: requestedRegion,
      allowInactiveCity: true,
    });
  } catch (error) {
    if (error instanceof RegionAccessError) notFound();
    throw error;
  }

  const allowedRegions = activeRegion.allowedRegionCodes.map(
    (code: RegionCode) => ({
      code,
      slug: REGIONS[code].urlSlug,
      label: REGIONS[code].label,
    }),
  );
  const adminIdentity = await getAdminIdentity(session.userId);
  const cities = await getOperatingCities(activeRegion.code, true);
  return (
    <AdminShell
      activeRegionSlug={activeRegion.config.urlSlug}
      activeRegionCode={activeRegion.code}
      activeCityCode={activeRegion.cityCode}
      operatingCities={cities.map((city) => ({
        code: city.cityCode,
        label: city.name,
      }))}
      allowedRegions={allowedRegions}
      adminIdentity={adminIdentity}
    >
      {children}
    </AdminShell>
  );
}
