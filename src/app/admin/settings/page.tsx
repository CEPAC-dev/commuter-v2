import CancellationSettingsForm from "@/components/admin/CancellationSettingsForm";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";

export default function AdminSettingsPage() {
  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="System and cancellation settings"
        description="Configure driver availability lock cutoffs, minimum wallet reserves, and late cancellation penalty tiers."
      />
      <CancellationSettingsForm />
    </AdminPageContainer>
  );
}
