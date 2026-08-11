"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { useClientLocale } from "@/lib/locale.client";
import { isPromoCodeExpired } from "@/lib/promoCodeShared";

interface PromoCodeRow {
  _id: string;
  code: string;
  discountPercentage: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface PromoLogRow {
  _id: string;
  discountPercentage: number;
  createdAt: string;
  user?: { name?: string; phone?: string };
  trip?: {
    tripNumber?: number;
    date?: string;
    pickup?: { address?: string };
    dropoff?: { address?: string };
  };
}

export default function PromoCodesManager() {
  const { t } = useClientLocale();
  const [items, setItems] = useState<PromoCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  const [lastCreatedCode, setLastCreatedCode] = useState("");
  const [selectedCodeId, setSelectedCodeId] = useState("");
  const [logs, setLogs] = useState<PromoLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [form, setForm] = useState({
    discountPercentage: "",
    maxUses: "",
    customCode: "",
    unlimitedUses: false,
    expiryDays: "0",
    expiryHours: "0",
    expiryMinutes: "0",
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadCodes() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/promo-codes?limit=100", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to load promo codes.");
      setItems(result.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load promo codes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCodes();
  }, []);

  async function createCode(event: React.FormEvent) {
    event.preventDefault();
    setCreateError("");

    const unlimitedUses = form.unlimitedUses;
    const expiryDays = Number(form.expiryDays || 0);
    const expiryHours = Number(form.expiryHours || 0);
    const expiryMinutes = Number(form.expiryMinutes || 0);
    const hasDuration = expiryDays > 0 || expiryHours > 0 || expiryMinutes > 0;

    if (
      !Number.isInteger(expiryDays) ||
      !Number.isInteger(expiryHours) ||
      !Number.isInteger(expiryMinutes) ||
      expiryDays < 0 ||
      expiryHours < 0 ||
      expiryMinutes < 0
    ) {
      setCreateError(t("admin.promo.expiry_non_negative"));
      return;
    }

    if (unlimitedUses && !hasDuration) {
      setCreateError(t("admin.promo.unlimited_requires_expiry"));
      return;
    }

    setSaving(true);
    setError("");
    setLastCreatedCode("");
    try {
      const response = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountPercentage: Number(form.discountPercentage),
          unlimitedUses,
          maxUses: unlimitedUses ? undefined : Number(form.maxUses),
          expiryDays,
          expiryHours,
          expiryMinutes,
          customCode: form.customCode.trim() || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to create promo code.");

      setForm({
        discountPercentage: "",
        maxUses: "",
        customCode: "",
        unlimitedUses: false,
        expiryDays: "0",
        expiryHours: "0",
        expiryMinutes: "0",
      });
      setLastCreatedCode(result.data.code);
      await loadCodes();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create promo code.");
    } finally {
      setSaving(false);
    }
  }

  async function patchCode(id: string, patch: Record<string, unknown>) {
    const response = await fetch(`/api/admin/promo-codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Failed to update promo code.");
    setItems((prev) => prev.map((item) => (item._id === id ? { ...item, ...result.data } : item)));
  }

  async function deactivateCode(id: string) {
    if (!window.confirm("Deactivate this promo code?")) return;
    const response = await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Failed to deactivate promo code.");
    setItems((prev) => prev.map((item) => (item._id === id ? { ...item, isActive: false } : item)));
  }

  async function loadLogs(id: string) {
    if (selectedCodeId === id) {
      setSelectedCodeId("");
      setLogs([]);
      return;
    }
    setSelectedCodeId(id);
    setLogsLoading(true);
    try {
      const response = await fetch(`/api/admin/promo-codes/${id}/logs`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to load logs.");
      setLogs(result.items ?? []);
    } catch (logError) {
      setError(logError instanceof Error ? logError.message : "Failed to load logs.");
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode(""), 1800);
  }

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [items],
  );

  return (
    <section style={{ display: "grid", gap: 18 }}>
      <form onSubmit={createCode} style={{ background: "#fff", border: "1px solid #e8edf0", borderRadius: 16, padding: 20, display: "grid", gap: 14 }}>
        <h2 style={{ margin: 0, color: "#0B1E3D", fontSize: 18 }}>Generate promo code</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <label style={labelStyle}>
            Discount %
            <input type="number" min={0} max={100} required value={form.discountPercentage} onChange={(event) => setForm((prev) => ({ ...prev, discountPercentage: event.target.value }))} style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, justifyContent: "end" }}>
            <span>{t("admin.promo.unlimited_uses")}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 44 }}>
              <input
                type="checkbox"
                checked={form.unlimitedUses}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, unlimitedUses: event.target.checked }))
                }
                style={{ width: 16, height: 16, accentColor: "#00C2A8" }}
              />
              <span style={{ color: "#5A6A7A", fontWeight: 600, fontSize: 12 }}>
                {form.unlimitedUses ? t("admin.promo.unlimited") : t("admin.promo.limited")}
              </span>
            </span>
          </label>
          <label style={labelStyle}>
            Max uses
            <input
              type="number"
              min={1}
              required={!form.unlimitedUses}
              disabled={form.unlimitedUses}
              value={form.maxUses}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, maxUses: event.target.value }))
              }
              style={{ ...inputStyle, opacity: form.unlimitedUses ? 0.55 : 1 }}
            />
          </label>
          <label style={labelStyle}>
            Custom code (optional)
            <input type="text" value={form.customCode} onChange={(event) => setForm((prev) => ({ ...prev, customCode: event.target.value.toUpperCase() }))} placeholder="PROMO-XXXXXX" style={inputStyle} />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <label style={labelStyle}>
            {t("admin.promo.expiry_days")}
            <input
              type="number"
              min={0}
              value={form.expiryDays}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, expiryDays: event.target.value }))
              }
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            {t("admin.promo.expiry_hours")}
            <input
              type="number"
              min={0}
              value={form.expiryHours}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, expiryHours: event.target.value }))
              }
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            {t("admin.promo.expiry_minutes")}
            <input
              type="number"
              min={0}
              value={form.expiryMinutes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, expiryMinutes: event.target.value }))
              }
              style={inputStyle}
            />
          </label>
        </div>
        {createError ? (
          <p style={{ margin: 0, color: "#e74c3c", fontSize: 13 }}>{createError}</p>
        ) : null}
        <button type="submit" disabled={saving} style={primaryButtonStyle(saving)}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {saving ? "Generating..." : "Generate code"}
        </button>
        {lastCreatedCode ? (
          <div style={{ border: "1px dashed #00C2A8", borderRadius: 12, padding: "10px 12px", background: "rgba(0,194,168,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <strong style={{ color: "#0B1E3D" }}>{lastCreatedCode}</strong>
            <button type="button" onClick={() => copyCode(lastCreatedCode)} style={copyButtonStyle}>
              {copiedCode === lastCreatedCode ? <Check size={14} /> : <Copy size={14} />}
              {copiedCode === lastCreatedCode ? "Copied" : "Copy"}
            </button>
          </div>
        ) : null}
      </form>

      <div style={{ background: "#fff", border: "1px solid #e8edf0", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #eef2f5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, color: "#0B1E3D", fontSize: 16 }}>Promo code list</h3>
          <button type="button" onClick={() => void loadCodes()} style={secondaryButtonStyle}>Refresh</button>
        </div>

        {error ? <p style={{ margin: "12px 16px", color: "#e74c3c", fontSize: 13 }}>{error}</p> : null}
        {loading ? (
          <p style={{ margin: "12px 16px", color: "#5A6A7A", fontSize: 13 }}>Loading...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f8f9fa" }}>
                <tr>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Discount</th>
                  <th style={thStyle}>Uses</th>
                  <th style={thStyle}>Expiry</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const isExpired = isPromoCodeExpired(item.expiresAt, nowMs);
                  const statusLabel = isExpired
                    ? t("admin.promo.expired")
                    : item.isActive
                      ? t("admin.promo.active")
                      : t("admin.promo.inactive");

                  return (
                  <tr key={item._id} style={{ borderTop: "1px solid #eef2f5" }}>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <strong>{item.code}</strong>
                        <button type="button" onClick={() => void copyCode(item.code)} style={iconButtonStyle}>
                          {copiedCode === item.code ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <InlineNumberEditor
                        value={item.discountPercentage}
                        min={0}
                        max={100}
                        onSave={async (value) => {
                          await patchCode(item._id, { discountPercentage: value });
                        }}
                        suffix="%"
                      />
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 12, color: "#5A6A7A" }}>
                          <input
                            type="checkbox"
                            checked={item.maxUses === null}
                            onChange={(event) => {
                              if (event.target.checked) {
                                void patchCode(item._id, { unlimitedUses: true });
                              } else {
                                void patchCode(item._id, {
                                  unlimitedUses: false,
                                  maxUses: Math.max(item.usedCount + 1, 1),
                                });
                              }
                            }}
                            style={{ width: 14, height: 14, accentColor: "#00C2A8" }}
                          />
                          {t("admin.promo.unlimited_uses")}
                        </label>

                        {item.maxUses === null ? (
                          <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                            {t("admin.promo.unlimited_used", {
                              count: String(item.usedCount),
                            })}
                          </span>
                        ) : (
                          <InlineNumberEditor
                            value={item.maxUses}
                            min={1}
                            onSave={async (value) => {
                              await patchCode(item._id, {
                                unlimitedUses: false,
                                maxUses: value,
                              });
                            }}
                            prefix={`${item.usedCount} / `}
                          />
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>{formatCountdown(item.expiresAt, nowMs, t)}</td>
                    <td style={tdStyle}>{new Date(item.createdAt).toLocaleString()}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "grid", gap: 8 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            width: "fit-content",
                            fontSize: 12,
                            fontWeight: 700,
                            color: isExpired ? "#B4790C" : item.isActive ? "#00877A" : "#5A6A7A",
                          }}
                        >
                          {statusLabel}
                        </span>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#5A6A7A" }}>
                          <input
                            type="checkbox"
                            checked={item.isActive}
                            onChange={(event) => {
                              void patchCode(item._id, {
                                isActive: event.target.checked,
                              });
                            }}
                            style={{ width: 16, height: 16, accentColor: "#00C2A8" }}
                          />
                          {t("admin.promo.active")}
                        </label>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => void loadLogs(item._id)} style={secondaryButtonStyle}>
                          {selectedCodeId === item._id ? "Hide logs" : "View logs"}
                        </button>
                        <button type="button" onClick={() => void deactivateCode(item._id)} style={dangerButtonStyle}>
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedCodeId ? (
        <div style={{ background: "#fff", border: "1px solid #e8edf0", borderRadius: 16, padding: 16 }}>
          <h3 style={{ margin: "0 0 10px", color: "#0B1E3D", fontSize: 16 }}>Usage logs</h3>
          {logsLoading ? (
            <p style={{ margin: 0, color: "#5A6A7A", fontSize: 13 }}>Loading logs...</p>
          ) : logs.length === 0 ? (
            <p style={{ margin: 0, color: "#5A6A7A", fontSize: 13 }}>No usage logs yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {logs.map((log) => (
                <div key={log._id} style={{ border: "1px solid #eef2f5", borderRadius: 10, padding: "10px 12px", background: "#f8f9fa" }}>
                  <p style={{ margin: 0, color: "#0B1E3D", fontWeight: 700, fontSize: 13 }}>
                    {log.user?.name ?? "Unknown user"} · {log.user?.phone ?? "No phone"}
                  </p>
                  <p style={{ margin: "4px 0 0", color: "#5A6A7A", fontSize: 12 }}>
                    Trip #{log.trip?.tripNumber ?? "-"} · {log.trip?.date ?? "-"}
                  </p>
                  <p style={{ margin: "4px 0 0", color: "#5A6A7A", fontSize: 12 }}>
                    {(log.trip?.pickup?.address ?? "-")} → {(log.trip?.dropoff?.address ?? "-")}
                  </p>
                  <p style={{ margin: "4px 0 0", color: "#00877A", fontSize: 12, fontWeight: 700 }}>
                    {log.discountPercentage}% used at {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function formatCountdown(
  expiresAt: string | null,
  nowMs: number,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (!expiresAt) return t("admin.promo.no_expiry");

  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return t("admin.promo.no_expiry");
  if (nowMs >= expiresAtMs) return t("admin.promo.expired");

  const totalSeconds = Math.floor((expiresAtMs - nowMs) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return t("admin.promo.countdown_format", {
    days: String(days),
    hours: String(hours),
    minutes: String(minutes),
    seconds: String(seconds),
  });
}

function InlineNumberEditor({
  value,
  min,
  max,
  onSave,
  prefix = "",
  suffix = "",
}: {
  value: number;
  min: number;
  max?: number;
  onSave: (value: number) => Promise<void>;
  prefix?: string;
  suffix?: string;
}) {
  const [saving, setSaving] = useState(false);

  async function save(nextValue: string) {
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed)) return;
    if (parsed < min) return;
    if (typeof max === "number" && parsed > max) return;
    if (parsed === value) return;
    setSaving(true);
    try {
      await onSave(parsed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {prefix ? <span style={{ fontSize: 12, color: "#5A6A7A" }}>{prefix}</span> : null}
      <input
        type="number"
        min={min}
        max={max}
        defaultValue={String(value)}
        onBlur={(event) => void save(event.currentTarget.value)}
        style={{ width: 64, height: 30, border: "1px solid #d0d8e0", borderRadius: 8, padding: "0 8px", fontSize: 13 }}
      />
      {suffix ? <span style={{ fontSize: 12, color: "#5A6A7A" }}>{suffix}</span> : null}
      {saving ? <Loader2 size={13} className="animate-spin" /> : null}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#0B1E3D",
  fontWeight: 700,
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  height: 44,
  border: "1.5px solid #d0d8e0",
  borderRadius: 10,
  padding: "0 12px",
  color: "#0B1E3D",
  fontSize: 14,
  fontFamily: "inherit",
};

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    minHeight: 46,
    border: 0,
    borderRadius: 10,
    background: disabled ? "#5A6A7A" : "#0B1E3D",
    color: "#ffffff",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "fit-content",
    padding: "0 16px",
  };
}

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 34,
  padding: "0 12px",
  border: "1px solid #d0d8e0",
  borderRadius: 8,
  background: "#ffffff",
  color: "#0B1E3D",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 12,
};

const dangerButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  borderColor: "rgba(231,76,60,0.45)",
  color: "#e74c3c",
};

const copyButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const iconButtonStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#00877A",
  cursor: "pointer",
  padding: 2,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  color: "#5A6A7A",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  color: "#0B1E3D",
  fontSize: 13,
  verticalAlign: "top",
};
