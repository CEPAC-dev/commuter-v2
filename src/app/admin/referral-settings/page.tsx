import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getOrCreateReferralSettings } from "@/lib/referral";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import ReferralSettingsForm from "@/components/admin/ReferralSettingsForm";

export const metadata = { title: "Referral settings - Commuter Admin" };

export default async function AdminReferralSettingsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/login");

  const settings = await getOrCreateReferralSettings();
  const initialValues = {
    discountPercentage: settings.discountPercentage,
    maxUsersPerCode: settings.maxUsersPerCode,
    discountValidForTrips: settings.discountValidForTrips,
    isActive: settings.isActive,
  };

  return (
    <main style={{ minHeight: "100dvh", background: "#F6F8F7", padding: "32px 20px 80px" }}>
      <div style={{ width: "100%", maxWidth: 680, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <p style={{ margin: 0, color: "#00877A", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Admin panel</p>
            <h1 style={{ margin: "6px 0 0", color: "#0B1E3D", fontSize: 32 }}>Referral settings</h1>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/admin/dashboard" style={{ minHeight: 44, padding: "0 14px", display: "inline-flex", alignItems: "center", color: "#0B1E3D", background: "#ffffff", border: "1px solid #e8edf0", borderRadius: 10, textDecoration: "none", fontWeight: 700 }}>Dashboard</Link>
            <AdminLogoutButton />
          </div>
        </header>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ width: 42, height: 42, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(0,194,168,0.12)", color: "#00877A" }}><Settings size={20} /></span>
          <p style={{ margin: 0, color: "#5A6A7A", fontSize: 14 }}>Changes apply only to referrals created after saving.</p>
        </div>
        <ReferralSettingsForm initialValues={initialValues} />
      </div>
    </main>
  );
}