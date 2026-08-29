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

  const [passengerSettings, driverSettings] = await Promise.all([
    getOrCreateReferralSettings("passenger"),
    getOrCreateReferralSettings("driver"),
  ]);
  const initialValues = {
    passenger: {
      referrerBonusAmount: passengerSettings.referrerBonusAmount,
      refereeBonusAmount: passengerSettings.refereeBonusAmount,
      maxUsersPerCode: passengerSettings.maxUsersPerCode,
      isActive: passengerSettings.isActive,
    },
    driver: {
      referrerBonusAmount: driverSettings.referrerBonusAmount,
      refereeBonusAmount: driverSettings.refereeBonusAmount,
      maxUsersPerCode: driverSettings.maxUsersPerCode,
      isActive: driverSettings.isActive,
    },
  };

  return (
    <main style={{ minHeight: "100dvh", background: "#F6F8F7", padding: "32px 20px 80px" }}>
      <div style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <p style={{ margin: 0, color: "#00877A", fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>Admin panel</p>
            <h1 style={{ margin: "6px 0 0", color: "#0B1E3D", fontSize: "clamp(24px, 4vw, 32px)" }}>Referral settings</h1>
            <p style={{ margin: "6px 0 0", color: "#5A6A7A", fontSize: 13.5, maxWidth: 480 }}>
              Configure separate referral bonuses and limits for passenger-owned and driver-owned codes.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/admin/dashboard" style={{ minHeight: 44, padding: "0 14px", display: "inline-flex", alignItems: "center", color: "#0B1E3D", background: "#ffffff", border: "1px solid #e2e8ed", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>Dashboard</Link>
            <AdminLogoutButton />
          </div>
        </header>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20, padding: "12px 16px", background: "#ffffff", border: "1px solid #e2e8ed", borderRadius: 8 }}>
          <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(0,194,168,0.12)", color: "#00877A" }}><Settings size={16} /></span>
          <p style={{ margin: 0, color: "#5A6A7A", fontSize: 13 }}>Changes apply only to referral codes created after saving, and only to codes owned by the selected role.</p>
        </div>
        <ReferralSettingsForm initialValues={initialValues} />
      </div>
    </main>
  );
}