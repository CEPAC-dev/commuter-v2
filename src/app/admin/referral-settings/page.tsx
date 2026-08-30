import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getOrCreateReferralSettings } from "@/lib/referral";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import ReferralSettingsForm from "@/components/admin/ReferralSettingsForm";
import ReferralUserOverrides from "@/components/admin/ReferralUserOverrides";
import {
  AdminCard,
  AdminPageContainer,
  AdminPageHeader,
} from "@/components/admin/layout";

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
    <AdminPageContainer maxWidth={980}>
      <AdminPageHeader
        title="Referral settings"
        description="Configure separate referral bonuses and limits for passenger-owned and driver-owned codes."
        icon={Settings}
        actions={
          <>
            <Link href="/admin/dashboard" style={{ minHeight: 44, padding: "0 14px", display: "inline-flex", alignItems: "center", color: "var(--color-primary)", background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>Dashboard</Link>
            <AdminLogoutButton />
          </>
        }
      />
      <AdminCard padding="12px 16px">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Settings size={16} aria-hidden="true" style={{ flexShrink: 0, color: "var(--color-secondary)" }} />
          <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 13 }}>Changes apply only to referral codes created after saving, and only to codes owned by the selected role.</p>
        </div>
      </AdminCard>
      <ReferralSettingsForm initialValues={initialValues} />
      <ReferralUserOverrides />
    </AdminPageContainer>
  );
}