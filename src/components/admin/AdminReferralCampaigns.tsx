"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Download, Infinity, Loader2, Save } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

type Role = "passenger" | "driver";
type Campaign = {
  id: string;
  role: Role;
  token: string;
  rewardAmount: number;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  shareUrl: string;
  registrants: {
    name: string;
    userNumber: number;
    phone: string;
    registeredAt: string;
  }[];
  history: {
    id: string;
    eventType: "created" | "updated" | "activated" | "deactivated" | "redeemed";
    createdAt: string;
    actor: { name: string; userNumber: number | null; phone: string };
    recipient: { name: string; userNumber: number | null; phone: string } | null;
    metadata?: { rewardAmount?: number; maxUses?: number | null; isActive?: boolean };
  }[];
};

export default function AdminReferralCampaigns({ selectedRole }: { selectedRole?: Role }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<Role | null>(null);
  const [message, setMessage] = useState("");
  const qrRefs = useRef<Record<Role, HTMLCanvasElement | null>>({ passenger: null, driver: null });

  useEffect(() => {
    fetch("/api/admin/referral-campaigns")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load admin referral campaigns.");
        setCampaigns(result.campaigns ?? []);
      })
      .catch((cause) => setMessage(cause instanceof Error ? cause.message : "Could not load campaigns."))
      .finally(() => setLoading(false));
  }, []);

  async function saveCampaign(campaign: Campaign) {
    setSavingRole(campaign.role);
    setMessage("");
    try {
      const response = await fetch("/api/admin/referral-campaigns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...campaign, unlimited: campaign.maxUses === null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save campaign.");
      setCampaigns((current) => current.map((item) => item.role === campaign.role
        ? { ...item, ...result.data, history: result.data.history ?? item.history ?? [] }
        : item));
      setMessage(`${campaign.role === "passenger" ? "Passenger" : "Driver"} admin referral link saved.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not save campaign.");
    } finally {
      setSavingRole(null);
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setMessage("Referral link copied.");
  }

  function downloadQr(campaign: Campaign) {
    const canvas = qrRefs.current[campaign.role];
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `admin-referral-${campaign.role}.png`;
    link.click();
  }

  function updateCampaign(role: Role, patch: Partial<Campaign>) {
    setCampaigns((current) => current.map((campaign) => campaign.role === role ? { ...campaign, ...patch } : campaign));
  }

  const visibleCampaigns = selectedRole
    ? campaigns.filter((campaign) => campaign.role === selectedRole)
    : campaigns;

  return (
    <section style={{ display: "grid", gap: 16 }}>
      {message ? <p role="status" style={{ margin: 0, color: "#00877A", fontSize: 13, fontWeight: 700 }}>{message}</p> : null}
      {loading ? <Loader2 size={18} className="animate-spin" aria-label="Loading" /> : visibleCampaigns.map((campaign) => (
        <CampaignCard
          key={campaign.role}
          campaign={campaign}
          saving={savingRole === campaign.role}
          qrRef={(node) => { qrRefs.current[campaign.role] = node; }}
          onChange={(patch) => updateCampaign(campaign.role, patch)}
          onSave={() => saveCampaign(campaign)}
          onCopy={() => copyLink(campaign.shareUrl)}
          onDownload={() => downloadQr(campaign)}
        />
      ))}
    </section>
  );
}

function CampaignCard({
  campaign,
  saving,
  qrRef,
  onChange,
  onSave,
  onCopy,
  onDownload,
}: {
  campaign: Campaign;
  saving: boolean;
  qrRef: (node: HTMLCanvasElement | null) => void;
  onChange: (patch: Partial<Campaign>) => void;
  onSave: () => void;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const label = campaign.role === "passenger" ? "Passenger" : "Driver";
  return (
    <div style={{ background: "#fff", border: "1px solid #eef0f3", borderRadius: 16, padding: 20, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, color: "#0B1E3D", fontSize: 17 }}>{label} admin link</h3>
          <p style={{ margin: "4px 0 0", color: "#5A6A7A", fontSize: 12 }}>One-sided reward campaign for {label.toLowerCase()} registration.</p>
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, color: campaign.isActive ? "#00877A" : "#5A6A7A", fontSize: 13, fontWeight: 800 }}>
          <input type="checkbox" checked={campaign.isActive} onChange={(event) => onChange({ isActive: event.target.checked })} />
          {campaign.isActive ? "Active" : "Deactivated"}
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <label style={fieldLabel}>Reward for recipient (EGP)<input type="number" min="0.01" step="0.01" value={campaign.rewardAmount} onChange={(event) => onChange({ rewardAmount: Number(event.target.value) })} style={inputStyle} /></label>
        <label style={fieldLabel}>Usage limit<input type="number" min="1" step="1" disabled={campaign.maxUses === null} value={campaign.maxUses ?? ""} onChange={(event) => onChange({ maxUses: Number(event.target.value) })} placeholder="Unlimited" style={inputStyle} /></label>
        <label style={{ ...fieldLabel, justifyContent: "center" }}><span style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={campaign.maxUses === null} onChange={(event) => onChange({ maxUses: event.target.checked ? null : 5 })} /><Infinity size={15} /> Unlimited usage</span></label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 160px", gap: 16, alignItems: "center" }}>
        <input readOnly value={campaign.shareUrl} onFocus={(event) => event.currentTarget.select()} style={{ ...inputStyle, direction: "ltr", fontSize: 12 }} />
        <div style={{ display: "flex", justifyContent: "center", padding: 10, background: "rgba(0,194,168,0.08)", borderRadius: 12 }}>
          <QRCodeCanvas value={campaign.shareUrl} size={128} bgColor="#fff" fgColor="#00877A" level="Q" ref={qrRef} />
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" onClick={onSave} disabled={saving} style={buttonStyle("#0B1E3D")}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save campaign</button>
        <button type="button" onClick={onCopy} style={buttonStyle("#00877A")}><Copy size={15} /> Copy link</button>
        <button type="button" onClick={onDownload} style={buttonStyle("#5A6A7A")}><Download size={15} /> Download PNG</button>
      </div>

      <div style={{ borderTop: "1px solid #eef0f3", paddingTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h4 style={{ margin: 0, color: "#0B1E3D", fontSize: 14 }}>Registered users</h4>
          <strong style={{ color: "#00877A", fontSize: 13 }}>{campaign.registrants.length} registered</strong>
        </div>
        <div style={{ maxHeight: 300, overflowY: "auto", display: "grid", gap: 8, marginTop: 10 }}>
          {campaign.registrants.length === 0 ? <span style={{ color: "#5A6A7A", fontSize: 12 }}>No users registered through this link yet.</span> : campaign.registrants.map((registrant, index) => (
            <div key={`${campaign.role}-${registrant.userNumber}-${index}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid #eef0f3", borderRadius: 10, background: "#fbfdfd" }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(0,194,168,0.14)", color: "#00877A", fontWeight: 800, fontSize: 12 }}>#{registrant.userNumber}</span>
              <span style={{ minWidth: 0, flex: 1 }}><strong style={{ display: "block", color: "#0B1E3D", fontSize: 13 }}>{registrant.name}</strong><span style={{ display: "block", marginTop: 3, color: "#5A6A7A", fontSize: 12 }}>{registrant.phone}</span></span>
              <time dateTime={registrant.registeredAt} style={{ color: "#5A6A7A", fontSize: 11, textAlign: "right" }}>{new Date(registrant.registeredAt).toLocaleString()}</time>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", minHeight: 40, padding: "0 10px", border: "1px solid #dfe8e7", borderRadius: 8, background: "#f8fafa", color: "#0B1E3D", fontSize: 13 };
const fieldLabel: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, color: "#0B1E3D", fontSize: 12, fontWeight: 700 };
function buttonStyle(color: string): React.CSSProperties { return { display: "inline-flex", alignItems: "center", gap: 6, border: 0, borderRadius: 8, padding: "9px 12px", background: color, color: "#fff", fontFamily: "inherit", fontSize: 12, fontWeight: 800, cursor: "pointer" }; }
