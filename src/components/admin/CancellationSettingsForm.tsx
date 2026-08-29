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
import { DEFAULT_PASSENGER_CANCELLATION_TIERS } from "@/models/AdminSettings";

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
  const [availabilityLockTime, setAvailabilityLockTime] = useState<string>("17:00");
  const [cancellationTiers, setCancellationTiers] = useState<DriverCancellationTier[]>([]);
  const [passengerCancellationTiers, setPassengerCancellationTiers] =
    useState<PassengerCancellationTier[]>(DEFAULT_PASSENGER_CANCELLATION_TIERS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const json = await res.json();
      if (json.data) {
        setWalletReserveAmount(json.data.walletReserveAmount ?? 200);
        setAvailabilityLockTime(json.data.availabilityLockTime ?? "17:00");
        setCancellationTiers(json.data.cancellationTiers ?? []);
        if (
          json.data.passengerCancellationTiers &&
          json.data.passengerCancellationTiers.length > 0
        ) {
          setPassengerCancellationTiers(json.data.passengerCancellationTiers);
        }
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  }

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
          availabilityLockTime,
          cancellationTiers,
          passengerCancellationTiers,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update settings");
      setMessage({ type: "success", text: "Policy settings saved successfully!" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400">
        Loading cancellation & penalty settings...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl text-sm font-medium ${
            message.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
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
      <div className="bg-[#0B1E3D]/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-[#00C2A8]/10 rounded-xl text-[#00C2A8]">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Passenger Cancellation & Refund Policy
            </h3>
            <p className="text-sm text-slate-400">
              Configure time-tiered refund percentages and cancellation blocks for passengers.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/60 text-xs text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Timing / Rule</th>
                <th className="px-4 py-3">Time of Day Rule</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Refund %</th>
                <th className="px-4 py-3">Penalty %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {passengerCancellationTiers.map((tier, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-medium text-white">
                    {tier.label === "four_plus_days_before" && "4+ Days before pickup"}
                    {tier.label === "two_to_three_days_before" && "2–3 Days before pickup"}
                    {tier.label === "day_before_pre_match" && "D-1 (Before 5:00 PM)"}
                    {tier.label === "day_before_during_match" && "D-1 (5:00 PM – 7:00 PM)"}
                    {tier.label === "day_before_post_match" && "D-1 (7:00 PM – Midnight)"}
                    {tier.label === "same_day" && "Day of pickup (D)"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                    {tier.timeOfDayRule || "Any time"}
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!tier.blocked}
                        onChange={(e) => handlePassengerBlockedToggle(idx, e.target.checked)}
                        className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-0 cursor-pointer"
                      />
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          tier.blocked
                            ? "bg-rose-500/20 text-rose-400"
                            : "bg-emerald-500/20 text-emerald-400"
                        }`}
                      >
                        {tier.blocked ? "BLOCKED" : "ALLOWED"}
                      </span>
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
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-sm focus:outline-none focus:border-[#00C2A8] disabled:opacity-40"
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-rose-400">
                    {tier.penaltyPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wallet Reserve Setting */}
      <div className="bg-[#0B1E3D]/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Wallet Minimum Reserve (EGP)</h3>
            <p className="text-sm text-slate-400">
              Non-withdrawable amount held in driver wallets to cover potential penalties.
            </p>
          </div>
        </div>

        <div className="max-w-xs">
          <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
            Global Reserve Amount (EGP)
          </label>
          <input
            type="number"
            min="0"
            step="10"
            value={walletReserveAmount}
            onChange={(e) => setWalletReserveAmount(Number(e.target.value))}
            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#00C2A8]"
            required
          />
        </div>
      </div>

      {/* Availability Lock Cutoff Time */}
      <div className="bg-[#0B1E3D]/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-teal-500/10 rounded-xl text-[#00C2A8]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Availability Lock Cutoff Time</h3>
            <p className="text-sm text-slate-400">
              Cutoff time on the day prior to the ride after which driver availability cannot be created, edited, or deleted.
            </p>
          </div>
        </div>

        <div className="max-w-xs">
          <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
            Lock Time (24h format HH:MM)
          </label>
          <input
            type="text"
            pattern="^\d{2}:\d{2}$"
            value={availabilityLockTime}
            onChange={(e) => setAvailabilityLockTime(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#00C2A8]"
            placeholder="17:00"
            required
          />
        </div>
      </div>

      {/* Time-Tiered Driver Cancellation Penalty Rules */}
      <div className="bg-[#0B1E3D]/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Driver Cancellation Penalty Rules</h3>
            <p className="text-sm text-slate-400">
              Configured penalty windows on the cutoff evening before the ride for drivers.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/60 text-xs text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Start Time</th>
                <th className="px-4 py-3">End Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Penalty %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cancellationTiers.map((tier, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-white">{tier.startTime}</td>
                  <td className="px-4 py-3 font-mono text-white">{tier.endTime}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                        tier.action === "free"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : tier.action === "blocked"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {tier.action.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-white">
                    {tier.penaltyPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-[#00C2A8] hover:bg-[#00a892] disabled:opacity-50 text-slate-950 font-semibold rounded-xl transition-colors shadow-lg shadow-[#00C2A8]/20 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Saving..." : "Save Policy Settings"}</span>
        </button>
      </div>
    </form>
  );
}
