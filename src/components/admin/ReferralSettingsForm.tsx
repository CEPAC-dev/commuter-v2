"use client";

import { useState } from "react";
import { Check, Loader2, Save } from "lucide-react";

export interface ReferralSettingsValues {
  discountPercentage: number;
  maxUsersPerCode: number;
  discountValidForTrips: number;
  isActive: boolean;
}

export default function ReferralSettingsForm({ initialValues }: { initialValues: ReferralSettingsValues }) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/referral-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save settings.");
      setValues(result.data);
      setMessage({ ok: true, text: "Referral settings saved." });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to save settings." });
    } finally {
      setSaving(false);
    }
  }

  const fields: Array<{ key: keyof ReferralSettingsValues; label: string; min: number; max?: number }> = [
    { key: "discountPercentage", label: "Discount percentage", min: 0, max: 100 },
    { key: "maxUsersPerCode", label: "Maximum users per code", min: 1 },
    { key: "discountValidForTrips", label: "Discounted trips per referral", min: 1 },
  ];

  return (
    <form onSubmit={handleSubmit} style={{ background: "#ffffff", border: "1px solid #e8edf0", borderRadius: 16, padding: 24, display: "grid", gap: 20 }}>
      {fields.map((field) => (
        <label key={field.key} style={{ display: "grid", gap: 7, color: "#0B1E3D", fontSize: 13, fontWeight: 700 }}>
          {field.label}
          <input
            type="number"
            min={field.min}
            max={field.max}
            step="1"
            required
            value={String(values[field.key])}
            onChange={(event) => setValues((current) => ({ ...current, [field.key]: Number(event.target.value) }))}
            style={{ height: 48, border: "1.5px solid #d0d8e0", borderRadius: 10, padding: "0 14px", color: "#0B1E3D", fontSize: 15, fontFamily: "inherit" }}
          />
        </label>
      ))}

      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 16px", background: "#f8f9fa", borderRadius: 10, color: "#0B1E3D", fontWeight: 700 }}>
        Referral program active
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(event) => setValues((current) => ({ ...current, isActive: event.target.checked }))}
          style={{ width: 20, height: 20, accentColor: "#00C2A8" }}
        />
      </label>

      {message ? (
        <p role={message.ok ? "status" : "alert"} style={{ margin: 0, color: message.ok ? "#00877A" : "#e74c3c", display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}>
          {message.ok ? <Check size={16} /> : null}{message.text}
        </p>
      ) : null}

      <button type="submit" disabled={saving} style={{ minHeight: 48, border: 0, borderRadius: 10, background: saving ? "#5A6A7A" : "#0B1E3D", color: "#ffffff", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
        {saving ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}