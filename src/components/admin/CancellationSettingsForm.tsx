"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  ShieldAlert,
  DollarSign,
  Save,
  CheckCircle2,
  AlertCircle,
  UserX,
} from "lucide-react";
import { DEFAULT_PASSENGER_CANCELLATION_TIERS } from "@/lib/config/cancellationDefaults";
import {
  AdminCard,
  AdminFormField,
  AdminFormLayout,
  AdminLoadingState,
  AdminStatusBadge,
  AdminTable,
} from "@/components/admin/layout";

interface DriverCancellationTier {
  startTime: string;
  endTime: string;
  action: "free" | "blocked" | "ride_only";
  penaltyPercent: number;
}

interface PassengerCancellationTier {
  daysBeforeMin: number;
  daysBeforeMax?: number | null;
  timeOfDayRule?: "before_match" | "during_match" | "after_match" | null;
  refundPercent: number;
  penaltyPercent: number;
  blocked?: boolean;
  label: string;
}

export default function CancellationSettingsForm() {
  const [walletReserveAmount, setWalletReserveAmount] = useState<number>(200);
  const [defaultWithdrawalLimit, setDefaultWithdrawalLimit] = useState<string>("");
  const [availabilityLockTime, setAvailabilityLockTime] = useState<string>("17:00");
  const [cancellationTiers, setCancellationTiers] = useState<DriverCancellationTier[]>([]);
  const [passengerCancellationTiers, setPassengerCancellationTiers] =
    useState<PassengerCancellationTier[]>(DEFAULT_PASSENGER_CANCELLATION_TIERS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function fetchSettings() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const json = await res.json();
      if (json.data) {
        setWalletReserveAmount(json.data.walletReserveAmount ?? 200);
        setDefaultWithdrawalLimit(
          json.data.defaultWithdrawalLimit !== null && json.data.defaultWithdrawalLimit !== undefined
            ? String(json.data.defaultWithdrawalLimit)
            : "",
        );
        setAvailabilityLockTime(json.data.availabilityLockTime ?? "17:00");
        setCancellationTiers(json.data.cancellationTiers ?? []);
        if (
          json.data.passengerCancellationTiers &&
          json.data.passengerCancellationTiers.length > 0
        ) {
          setPassengerCancellationTiers(json.data.passengerCancellationTiers);
        }
      }
    } catch (error: unknown) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSettings();
  }, []);

  function handlePassengerTierChange(index: number, refundPercent: number) {
    const safeRefund = Math.min(100, Math.max(0, refundPercent));
    setPassengerCancellationTiers((prev) =>
      prev.map((tier, idx) =>
        idx === index
          ? {
              ...tier,
              refundPercent: safeRefund,
              penaltyPercent: 100 - safeRefund,
            }
          : tier,
      ),
    );
  }

  function handlePassengerBlockedToggle(index: number, blocked: boolean) {
    setPassengerCancellationTiers((prev) =>
      prev.map((tier, idx) =>
        idx === index
          ? {
              ...tier,
              blocked,
              refundPercent: blocked ? 0 : tier.refundPercent,
              penaltyPercent: blocked ? 100 : tier.penaltyPercent,
            }
          : tier,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage(null);
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletReserveAmount: Number(walletReserveAmount),
          defaultWithdrawalLimit:
            defaultWithdrawalLimit.trim() === "" ? null : Number(defaultWithdrawalLimit),
          availabilityLockTime,
          cancellationTiers,
          passengerCancellationTiers,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update settings");
      setMessage({ type: "success", text: "Policy settings saved successfully!" });
    } catch (error: unknown) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AdminLoadingState title="Loading cancellation and penalty settings..." />;
  }

  return (
    <AdminFormLayout onSubmit={handleSubmit} className="max-w-4xl gap-6">
      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl text-sm font-medium ${
            message.type === "success"
              ? "bg-[var(--color-success-tint)] border border-[var(--color-success)] text-[var(--color-success)]"
              : "bg-[var(--color-danger-tint)] border border-[var(--color-danger)] text-[var(--color-danger)]"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Passenger Cancellation & Refund Policy */}
      <AdminCard padding={24}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-[var(--color-secondary-tint)] rounded-xl text-[var(--color-secondary)]">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-primary)]">
              Passenger Cancellation & Refund Policy
            </h3>
            <p className="text-sm text-[var(--color-muted)]">
              Configure time-tiered refund percentages and cancellation blocks for passengers.
            </p>
          </div>
        </div>

          <AdminTable ariaLabel="Passenger cancellation policy">
            <thead className="bg-[var(--color-background)] text-xs text-[var(--color-muted)] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Timing / Rule</th>
                <th className="px-4 py-3">Time of Day Rule</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Refund %</th>
                <th className="px-4 py-3">Penalty %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {passengerCancellationTiers.map((tier, idx) => (
                <tr key={idx} className="hover:bg-[var(--color-primary-tint)]">
                  <td className="px-4 py-3 font-medium text-[var(--color-primary)]">
                    {tier.label === "four_plus_days_before" && "4+ Days before pickup"}
                    {tier.label === "two_to_three_days_before" && "2–3 Days before pickup"}
                    {tier.label === "day_before_pre_match" && "D-1 (Before 5:00 PM)"}
                    {tier.label === "day_before_during_match" && "D-1 (5:00 PM – 7:00 PM)"}
                    {tier.label === "day_before_post_match" && "D-1 (7:00 PM – Midnight)"}
                    {tier.label === "same_day" && "Day of pickup (D)"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)] font-mono">
                    {tier.timeOfDayRule || "Any time"}
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!tier.blocked}
                        onChange={(e) => handlePassengerBlockedToggle(idx, e.target.checked)}
                        className="rounded bg-[var(--color-panel)] border-[var(--color-border)] text-[var(--color-danger)] focus:ring-0 cursor-pointer"
                      />
                      <AdminStatusBadge status={tier.blocked ? "blocked" : "allowed"} tone={tier.blocked ? "danger" : "success"} />
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      disabled={!!tier.blocked}
                      value={tier.refundPercent}
                      onChange={(e) => handlePassengerTierChange(idx, Number(e.target.value))}
                      className="w-20 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg px-2.5 py-1 text-[var(--color-primary)] text-sm focus:outline-none focus:border-[var(--color-secondary)] disabled:opacity-40"
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-[var(--color-danger)]">
                    {tier.penaltyPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
      </AdminCard>

      {/* Wallet Reserve & Withdrawal Limit Settings */}
      <AdminCard padding={24}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-[var(--color-warning-tint)] rounded-xl text-[var(--color-warning)]">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-primary)]">Driver Wallet Reserve & Withdrawal Limits</h3>
            <p className="text-sm text-[var(--color-muted)]">
              Configure global defaults for minimum reserve floor and maximum withdrawal limit ceiling per request.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
          <AdminFormField label="Global Reserve Amount (Floor, EGP)">
            <input
              type="number"
              min="0"
              step="10"
              value={walletReserveAmount}
              onChange={(e) => setWalletReserveAmount(Number(e.target.value))}
              className="w-full bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-primary)] focus:outline-none focus:border-[var(--color-secondary)]"
              required
            />
          </AdminFormField>
          <AdminFormField label="Default Withdrawal Limit (Ceiling, EGP)">
            <input
              type="number"
              min="1"
              step="100"
              placeholder="Unlimited (leave empty)"
              value={defaultWithdrawalLimit}
              onChange={(e) => setDefaultWithdrawalLimit(e.target.value)}
              className="w-full bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-primary)] focus:outline-none focus:border-[var(--color-secondary)]"
            />
          </AdminFormField>
        </div>
      </AdminCard>

      {/* Availability Lock Cutoff Time */}
      <AdminCard padding={24}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-[var(--color-secondary-tint)] rounded-xl text-[var(--color-secondary)]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-primary)]">Availability Lock Cutoff Time</h3>
            <p className="text-sm text-[var(--color-muted)]">
              Cutoff time on the day prior to the ride after which driver availability cannot be created, edited, or deleted.
            </p>
          </div>
        </div>

        <div className="max-w-xs">
          <AdminFormField label="Lock Time (24h format HH:MM)">
          <input
            type="text"
            pattern="^\d{2}:\d{2}$"
            value={availabilityLockTime}
            onChange={(e) => setAvailabilityLockTime(e.target.value)}
            className="w-full bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-primary)] focus:outline-none focus:border-[var(--color-secondary)]"
            placeholder="17:00"
            required
          />
          </AdminFormField>
        </div>
      </AdminCard>

      {/* Time-Tiered Driver Cancellation Penalty Rules */}
      <AdminCard padding={24}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-[var(--color-danger-tint)] rounded-xl text-[var(--color-danger)]">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-primary)]">Driver Cancellation Penalty Rules</h3>
            <p className="text-sm text-[var(--color-muted)]">
              Configured penalty windows on the cutoff evening before the ride for drivers.
            </p>
          </div>
        </div>

          <AdminTable ariaLabel="Driver cancellation penalty rules">
            <thead className="bg-[var(--color-background)] text-xs text-[var(--color-muted)] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Start Time</th>
                <th className="px-4 py-3">End Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Penalty %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {cancellationTiers.map((tier, idx) => (
                <tr key={idx} className="hover:bg-[var(--color-primary-tint)]">
                  <td className="px-4 py-3 font-mono text-[var(--color-primary)]">{tier.startTime}</td>
                  <td className="px-4 py-3 font-mono text-[var(--color-primary)]">{tier.endTime}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={tier.action} tone={tier.action === "free" ? "success" : tier.action === "blocked" ? "danger" : "warning"} />
                  </td>
                  <td className="px-4 py-3 font-semibold text-[var(--color-primary)]">
                    {tier.penaltyPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
      </AdminCard>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--color-secondary)] disabled:opacity-50 text-[var(--color-primary)] font-semibold rounded-xl transition-colors shadow-lg cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Saving..." : "Save Policy Settings"}</span>
        </button>
      </div>
    </AdminFormLayout>
  );
}
