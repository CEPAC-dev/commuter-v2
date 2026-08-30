"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Car,
  Check,
  Gift,
  Loader2,
  Save,
  Sparkles,
  Users,
  UserRound,
} from "lucide-react";
import {
  AdminCard,
  AdminFormField,
  AdminFormLayout,
  AdminStatusBadge,
} from "@/components/admin/layout";

export interface ReferralSettingsValues {
  referrerBonusAmount: number;
  refereeBonusAmount: number;
  maxUsersPerCode: number;
  isActive: boolean;
}

type ReferralOwnerRole = "passenger" | "driver";
type SettingsByRole = Record<ReferralOwnerRole, ReferralSettingsValues>;

const ROLE_OPTIONS: Array<{ key: ReferralOwnerRole; label: string; icon: typeof UserRound }> = [
  { key: "passenger", label: "Passenger", icon: UserRound },
  { key: "driver", label: "Driver", icon: Car },
];

function fieldsEqual(a: ReferralSettingsValues, b: ReferralSettingsValues) {
  return (
    a.referrerBonusAmount === b.referrerBonusAmount &&
    a.refereeBonusAmount === b.refereeBonusAmount &&
    a.maxUsersPerCode === b.maxUsersPerCode &&
    a.isActive === b.isActive
  );
}

export default function ReferralSettingsForm({
  initialValues,
}: {
  initialValues: SettingsByRole;
}) {
  const [role, setRole] = useState<ReferralOwnerRole>("passenger");
  const [savedByRole, setSavedByRole] = useState(initialValues);
  const [draftByRole, setDraftByRole] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const values = draftByRole[role];
  const roleLabel = role === "driver" ? "Driver" : "Passenger";
  const isDirty = !fieldsEqual(values, savedByRole[role]);

  function updateValues(updater: (current: ReferralSettingsValues) => ReferralSettingsValues) {
    setDraftByRole((current) => ({ ...current, [role]: updater(current[role]) }));
  }

  function selectRole(next: ReferralOwnerRole) {
    setRole(next);
    setMessage(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isDirty) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/referral-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, role }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save settings.");
      setSavedByRole((current) => ({ ...current, [role]: result.data }));
      setDraftByRole((current) => ({ ...current, [role]: result.data }));
      setMessage({ ok: true, text: `${roleLabel} referral settings saved.` });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to save settings." });
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    setDraftByRole((current) => ({ ...current, [role]: savedByRole[role] }));
    setMessage(null);
  }

  return (
    <div className="referral-settings-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 20, alignItems: "start" }}>
      <style>{`
        @media (max-width: 760px) {
          .referral-settings-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <AdminCard padding={0}>
      <AdminFormLayout onSubmit={handleSubmit}>
        {/* Role switch */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--color-border)" }}>
          <p style={eyebrowStyle}>Referral code owner</p>
          <div
            role="tablist"
            aria-label="Referral code owner"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4, marginTop: 10, background: "var(--color-background)", borderRadius: 8 }}
          >
            {ROLE_OPTIONS.map((option) => {
              const active = role === option.key;
              const Icon = option.icon;
              const dirty = !fieldsEqual(draftByRole[option.key], savedByRole[option.key]);
              return (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectRole(option.key)}
                  style={{
                    position: "relative",
                    minHeight: 40,
                    border: 0,
                    borderRadius: 6,
                    background: active ? "var(--color-panel)" : "var(--color-transparent)",
                    boxShadow: active ? "0 1px 4px var(--color-shadow)" : "none",
                    color: active ? "var(--color-primary)" : "var(--color-muted)",
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Icon size={15} aria-hidden="true" />
                  {option.label}
                  {dirty ? (
                    <span
                      aria-label="Unsaved changes"
                      style={{ position: "absolute", top: 6, right: 10, width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent)" }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bonus amounts */}
        <fieldset style={fieldsetStyle}>
          <legend style={legendStyle}>
            <Gift size={14} aria-hidden="true" /> Bonus amounts
          </legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <NumberField
              label="Referral code owner bonus"
              hint={`Paid to the ${role} who shares the code`}
              suffix="EGP"
              min={0}
              value={values.referrerBonusAmount}
              onChange={(next) => updateValues((current) => ({ ...current, referrerBonusAmount: next }))}
            />
            <NumberField
              label="New passenger bonus"
              hint="Paid to whoever redeems the code"
              suffix="EGP"
              min={0}
              value={values.refereeBonusAmount}
              onChange={(next) => updateValues((current) => ({ ...current, refereeBonusAmount: next }))}
            />
          </div>
        </fieldset>

        {/* Usage limits */}
        <fieldset style={fieldsetStyle}>
          <legend style={legendStyle}>
            <Users size={14} aria-hidden="true" /> Usage limits
          </legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <NumberField
              label="Maximum users per code"
              hint="Redemptions allowed for a single code"
              min={1}
              value={values.maxUsersPerCode}
              onChange={(next) => updateValues((current) => ({ ...current, maxUsersPerCode: next }))}
            />
          </div>
        </fieldset>

        {/* Status */}
        <div style={{ padding: "16px 20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: "14px 16px",
              background: values.isActive ? "var(--color-secondary-tint)" : "var(--color-background)",
              border: `1px solid ${values.isActive ? "var(--color-secondary)" : "var(--color-border)"}`,
              borderRadius: 8,
            }}
          >
            <div>
              <label htmlFor={`referral-active-${role}`} style={{ display: "block", fontWeight: 800, color: "var(--color-primary)", fontSize: 14, cursor: "pointer" }}>
                {roleLabel} referrals active
              </label>
              <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--color-muted)" }}>
                {values.isActive ? `New ${role} referral codes can be redeemed.` : `New ${role} referral codes are paused.`}
              </p>
            </div>
            <ToggleSwitch
              id={`referral-active-${role}`}
              checked={values.isActive}
              onChange={(checked) => updateValues((current) => ({ ...current, isActive: checked }))}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            padding: "16px 20px",
            borderTop: "1px solid var(--color-border)",
            background: "var(--color-surface)",
          }}
        >
          <div style={{ minHeight: 20 }}>
            {message ? (
              <p
                role={message.ok ? "status" : "alert"}
                style={{ margin: 0, color: message.ok ? "var(--color-secondary-deep)" : "var(--color-danger)", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}
              >
                {message.ok ? <Check size={15} /> : <AlertCircle size={15} />}
                {message.text}
              </p>
            ) : isDirty ? (
              <p style={{ margin: 0, color: "var(--color-accent-deep)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent)" }} />
                Unsaved changes
              </p>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {isDirty ? (
              <button type="button" onClick={discardChanges} style={ghostButtonStyle}>
                Discard
              </button>
            ) : null}
            <button type="submit" disabled={saving || !isDirty} style={primaryButtonStyle(saving || !isDirty)}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Saving..." : `Save ${roleLabel.toLowerCase()} settings`}
            </button>
          </div>
        </div>
      </AdminFormLayout>
      </AdminCard>

      <SummarySidebar draftByRole={draftByRole} />
    </div>
  );
}

function NumberField({
  label,
  hint,
  suffix,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  suffix?: string;
  min: number;
  max?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <AdminFormField label={label} hint={hint}>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          height: 46,
          border: "1px solid var(--color-border)",
          borderRadius: 7,
          background: "var(--color-background)",
          overflow: "hidden",
        }}
      >
        <input
          type="number"
          min={min}
          max={max}
          step="1"
          required
          value={String(value)}
          onChange={(event) => onChange(Number(event.target.value))}
          style={{ flex: 1, minWidth: 0, height: "100%", border: 0, background: "transparent", padding: "0 14px", color: "var(--color-primary)", fontSize: 15, fontFamily: "inherit", outline: "none" }}
        />
        {suffix ? (
          <span style={{ padding: "0 14px", height: "100%", display: "inline-flex", alignItems: "center", color: "var(--color-muted)", fontSize: 12.5, fontWeight: 700, background: "var(--color-surface)", borderLeft: "1px solid var(--color-border)" }}>
            {suffix}
          </span>
        ) : null}
      </span>
    </AdminFormField>
  );
}

function ToggleSwitch({ id, checked, onChange }: { id: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        flexShrink: 0,
        width: 44,
        height: 26,
        borderRadius: 999,
        border: "none",
        background: checked ? "var(--color-secondary)" : "var(--color-border)",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "var(--color-panel)",
          boxShadow: "0 1px 3px var(--color-shadow-strong)",
          transition: "left 0.15s ease",
        }}
      />
    </button>
  );
}

function SummarySidebar({ draftByRole }: { draftByRole: SettingsByRole }) {
  const rows = useMemo(
    () =>
      ROLE_OPTIONS.map((option) => ({
        ...option,
        values: draftByRole[option.key],
      })),
    [draftByRole],
  );

  return (
    <AdminCard padding={20} style={{ position: "sticky", top: 20 }}>
      <div style={{ display: "grid", gap: 16 }}>
      <p style={{ ...eyebrowStyle, display: "flex", alignItems: "center", gap: 6 }}>
        <Sparkles size={13} aria-hidden="true" /> Live overview
      </p>
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <div key={row.key} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 14, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 28, height: 28, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--color-secondary-tint)", color: "var(--color-secondary)" }}>
                <Icon size={14} aria-hidden="true" />
              </span>
              <span style={{ fontWeight: 800, color: "var(--color-primary)", fontSize: 13.5 }}>{row.label}</span>
              <span style={{ marginInlineStart: "auto" }}>
                <AdminStatusBadge status={row.values.isActive ? "active" : "paused"} />
              </span>
            </div>
            <dl style={{ margin: 0, display: "grid", gap: 6, fontSize: 12.5 }}>
              <SummaryRow label="Owner bonus" value={`${row.values.referrerBonusAmount} EGP`} />
              <SummaryRow label="New user bonus" value={`${row.values.refereeBonusAmount} EGP`} />
              <SummaryRow label="Max uses" value={String(row.values.maxUsersPerCode)} />
            </dl>
          </div>
        );
      })}
      </div>
    </AdminCard>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <dt style={{ color: "var(--color-muted)" }}>{label}</dt>
      <dd style={{ margin: 0, color: "var(--color-primary)", fontWeight: 700 }}>{value}</dd>
    </div>
  );
}

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--color-secondary-deep)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const fieldsetStyle: React.CSSProperties = {
  margin: 0,
  border: 0,
  padding: "18px 20px",
  borderBottom: "1px solid var(--color-border)",
  display: "grid",
  gap: 14,
};

const legendStyle: React.CSSProperties = {
  padding: 0,
  marginBottom: 2,
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  fontWeight: 800,
  color: "var(--color-primary)",
};

const ghostButtonStyle: React.CSSProperties = {
  minHeight: 44,
  padding: "0 16px",
  border: "1px solid var(--color-border)",
  borderRadius: 7,
  background: "var(--color-panel)",
  color: "var(--color-primary)",
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
  fontFamily: "inherit",
};

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    minHeight: 44,
    padding: "0 18px",
    border: 0,
    borderRadius: 7,
    background: disabled ? "var(--color-disabled)" : "var(--color-primary)",
    color: "var(--color-on-primary)",
    fontWeight: 800,
    fontSize: 13.5,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontFamily: "inherit",
  };
}