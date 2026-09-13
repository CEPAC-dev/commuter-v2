import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import AdminShell from "@/components/admin/layout/AdminShell";
import { getSession } from "@/lib/auth/session";
import { REGIONS, type RegionCode } from "@/lib/config/regions";
import {
  RegionAccessError,
  resolveActiveRegion,
} from "@/lib/regions/resolveActiveRegion";

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
  try {
    const activeRegion = await resolveActiveRegion({
      userId: session.userId,
      requested: requestedRegion,
    });
    const allowedRegions = activeRegion.allowedRegionCodes.map(
      (code: RegionCode) => ({
        code,
        slug: REGIONS[code].urlSlug,
        label: REGIONS[code].label,
      }),
    );
    return (
      <AdminShell
        activeRegionSlug={activeRegion.config.urlSlug}
        allowedRegions={allowedRegions}
      >
        {children}
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof RegionAccessError) notFound();
    throw error;
  }
}
