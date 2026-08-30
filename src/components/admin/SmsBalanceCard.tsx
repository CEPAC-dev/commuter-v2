"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { AdminCard } from "@/components/admin/layout";

export default function SmsBalanceCard() {
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadBalance() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/sms/balance", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load SMS balance.");
      setBalance(typeof data.balance === "string" ? data.balance : JSON.stringify(data.balance));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load SMS balance.");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches the protected live balance after the dashboard mounts.
  useEffect(() => { void loadBalance(); }, []);

  return (
    <AdminCard title="SMS Misr balance" description="Live account balance for OTP messages">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <p style={{ margin: 0, color: error ? "var(--color-danger, #c0392b)" : "var(--color-primary)", fontSize: balance ? 24 : 13, fontWeight: balance ? 800 : 600, overflowWrap: "anywhere" }}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : error || balance || "Unavailable"}
        </p>
        <button type="button" onClick={loadBalance} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-background)", color: "var(--color-primary)", padding: "9px 12px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}><RefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh</button>
      </div>
    </AdminCard>
  );
}
