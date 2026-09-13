import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { resolveActiveRegion } from "@/lib/regions/resolveActiveRegion";
export default async function AdminStationsRedirect() { const session = await getSession(); if (!session || session.role !== "admin") redirect("/admin/login"); const region = await resolveActiveRegion({ userId: session.userId }); redirect(`/${region.config.urlSlug}/admin/stations`); }
