import CancellationSettingsForm from "@/components/admin/CancellationSettingsForm";

export default function AdminSettingsPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System & Cancellation Policy Settings</h1>
        <p className="text-sm text-slate-400">
          Configure driver availability lock cutoffs, minimum wallet reserves, and late cancellation penalty tiers.
        </p>
      </div>

      <CancellationSettingsForm />
    </div>
  );
}
