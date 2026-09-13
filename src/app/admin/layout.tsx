import type { ReactNode } from "react";
import AdminShell from "@/components/admin/layout/AdminShell";
import { getSession } from "@/lib/auth/session";
import { REGIONS, type RegionCode } from "@/lib/config/regions";
import { resolveActiveRegion } from "@/lib/regions/resolveActiveRegion";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  // The login/signup routes live under this layout. Do not redirect an
  // unauthenticated request back to /admin/login, which creates a 307 loop.
  if (!session || session.role !== "admin") return <AdminShell>{children}</AdminShell>;
  const activeRegion = await resolveActiveRegion({ userId: session.userId });
  const allowedRegions = activeRegion.allowedRegionCodes.map((code: RegionCode) => ({ code, slug: REGIONS[code].urlSlug, label: REGIONS[code].label }));
  return <AdminShell activeRegionSlug={activeRegion.config.urlSlug} allowedRegions={allowedRegions}>{children}</AdminShell>;
}
