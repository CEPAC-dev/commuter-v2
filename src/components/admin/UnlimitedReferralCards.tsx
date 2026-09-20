"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Infinity,
  Loader2,
  Search,
  ShieldAlert,
  UserCheck,
  XCircle,
} from "lucide-react";

type UserResult = {
  id: string;
  userNumber: number | null;
  name: string;
  role: string;
  phone: string;
  referralCode: string | null;
  referralUnlimited: boolean;
  usageCount: number;
  creditedCount: number;
  maxUsersPerCode: number;
};

type AuditLog = {
  id: string;
  targetUserId: string;
  eventType: "unlimited_activated" | "unlimited_deactivated";
  createdAt: string;
  actor: { name: string; userNumber: number | null; phone: string };
};

function matchesQuery(user: UserResult, rawQuery: string) {
  const query = rawQuery.trim();
  if (!query) return true;
  if (query.startsWith("#")) {
    const number = query.slice(1).trim();
    return /^\d+$/.test(number) && String(user.userNumber ?? "") === number;
  }
  const normalized = query.toLowerCase();
  return user.name.toLowerCase().includes(normalized);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function UnlimitedReferralCards() {
  const [query, setQuery] = useState("");
  const [activeUsers, setActiveUsers] = useState<UserResult[]>([]);
  const [searchUsers, setSearchUsers] = useState<UserResult[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function loadAuditHistory() {
    return fetch("/api/admin/referral-settings/history")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load referral history.");
        setAuditLogs(result.unlimitedActivated ?? []);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load referral history."));
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users/unlimited").then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load Unlimited Referral users.");
        setActiveUsers(result.data ?? []);
      }),
      loadAuditHistory(),
    ])
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load Unlimited Referral users."))
      .finally(() => setLoading(false));

    const refresh = () => {
      loadAuditHistory();
      fetch("/api/admin/users/unlimited")
        .then((response) => response.json())
        .then((result) => setActiveUsers(result.data ?? []))
        .catch(() => undefined);
    };
    window.addEventListener("referral-audit-changed", refresh);
    return () => window.removeEventListener("referral-audit-changed", refresh);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/admin/users/search?q=${encodeURIComponent(trimmed)}`)
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Search failed.");
          setSearchUsers(result.data ?? []);
        })
        .catch((cause) => setError(cause instanceof Error ? cause.message : "Search failed."))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const displayedUsers = useMemo(() => {
    const source = query.trim() ? searchUsers : activeUsers;
    return source.filter((user) => matchesQuery(user, query));
  }, [activeUsers, query, searchUsers]);

  const logsByUser = useMemo(() => {
    const grouped = new Map<string, AuditLog[]>();
    for (const log of auditLogs) {
      const logs = grouped.get(log.targetUserId) ?? [];
      logs.push(log);
      grouped.set(log.targetUserId, logs);
    }
    for (const logs of grouped.values()) {
      logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return grouped;
  }, [auditLogs]);

  async function toggleUnlimited(user: UserResult) {
    setTogglingId(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/referral-unlimited`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlimited: !user.referralUnlimited }),
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(result.error ?? "Failed to update user.");
      const update = (current: UserResult[]) => current.map((item) => item.id === user.id ? { ...item, referralUnlimited: !user.referralUnlimited } : item);
      setActiveUsers((current) => !user.referralUnlimited
        ? update(current).some((item) => item.id === user.id)
          ? update(current)
          : [...update(current), { ...user, referralUnlimited: true }]
        : current.filter((item) => item.id !== user.id));
      setSearchUsers(update);
      window.dispatchEvent(new Event("referral-audit-changed"));
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Failed to update user.");
    } finally {
      setTogglingId(null);
    }
  }

  function toggleExpanded(userId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  return (
    <section style={{ marginTop: 24, background: "#fff", border: "1px solid #eef0f3", borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <span style={{ width: 40, height: 40, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(11,30,61,0.08)", color: "#0B1E3D" }}><Infinity size={20} /></span>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: "#0B1E3D" }}>Unlimited Referral Usage Overrides</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#5A6A7A" }}>Search by name or exact User number, then expand a card to see its history.</p>
        </div>
      </div>

      <div style={{ position: "relative", marginBottom: 14 }}>
        <Search size={16} aria-hidden="true" style={{ position: "absolute", left: 12, top: 12, color: "#5A6A7A" }} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or exact #User number..." aria-label="Search Unlimited Referral users" style={{ width: "100%", boxSizing: "border-box", height: 40, padding: "0 12px 0 36px", border: "1px solid #dfe8e7", borderRadius: 9, background: "#f8fafa", color: "#0B1E3D", outline: "none", fontSize: 13 }} />
        {searching ? <Loader2 size={15} className="animate-spin" aria-label="Searching" style={{ position: "absolute", right: 12, top: 12, color: "#00C2A8" }} /> : null}
      </div>

      {error ? <p role="alert" style={{ margin: "0 0 12px", color: "#e74c3c", fontSize: 13 }}>{error}</p> : null}
      {loading ? <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#5A6A7A", fontSize: 13 }}><Loader2 size={16} className="animate-spin" /> Loading...</div> : displayedUsers.length === 0 ? <p style={{ margin: 0, color: "#5A6A7A", fontSize: 13 }}>{query.trim() ? "No users match your search." : "No activated unlimited referral overrides."}</p> : (
        <div style={{ border: "1px solid #eef0f3", borderRadius: 12, overflow: "hidden" }}>
          {displayedUsers.map((user) => {
            const logs = logsByUser.get(user.id) ?? [];
            const latest = logs[0];
            const expanded = expandedIds.has(user.id);
            return (
              <div key={user.id} style={{ borderBottom: "1px solid #eef0f3" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: expanded ? "#f7fbfa" : "#fff" }}>
                  <button type="button" onClick={() => toggleExpanded(user.id)} aria-expanded={expanded} aria-label={`Show history for ${user.name}`} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                    <span style={{ width: 38, height: 38, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: user.referralUnlimited ? "rgba(0,194,168,0.14)" : "rgba(231,76,60,0.1)", color: user.referralUnlimited ? "#00877A" : "#c0392b" }}>{user.referralUnlimited ? <CheckCircle2 size={19} /> : <XCircle size={19} />}</span>
                    <span style={{ minWidth: 0 }}><strong style={{ display: "block", color: "#0B1E3D", fontSize: 14 }}>{user.name}</strong><span style={{ display: "block", marginTop: 3, color: "#5A6A7A", fontSize: 12 }}>User #{user.userNumber ?? "N/A"} · {user.phone}</span></span>
                    <span style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}><strong style={{ display: "block", color: user.referralUnlimited ? "#00877A" : "#c0392b", fontSize: 12 }}>{user.referralUnlimited ? "Active" : "Off"}</strong><span style={{ display: "block", marginTop: 3, color: "#5A6A7A", fontSize: 11 }}>{latest ? formatDate(latest.createdAt) : "No recorded changes"}</span></span>
                    <ChevronDown size={17} style={{ flexShrink: 0, color: "#5A6A7A", transform: expanded ? "rotate(180deg)" : "none" }} />
                  </button>
                  <button type="button" onClick={() => toggleUnlimited(user)} disabled={togglingId === user.id} style={{ padding: "6px 12px", borderRadius: 8, border: user.referralUnlimited ? "1px solid #00C2A8" : "1px solid #dcdfe4", background: user.referralUnlimited ? "rgba(0,194,168,0.1)" : "#f8f9fa", color: user.referralUnlimited ? "#00877A" : "#5A6A7A", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>{togglingId === user.id ? <Loader2 size={14} className="animate-spin" /> : user.referralUnlimited ? <UserCheck size={14} /> : <ShieldAlert size={14} />}{user.referralUnlimited ? "Unlimited ON" : "Unlimited OFF"}</button>
                </div>
                {expanded ? <div style={{ padding: "0 16px 14px 66px", display: "grid", gap: 8, background: "#f7fbfa" }}>{logs.length ? logs.map((log) => <div key={log.id} style={{ padding: "9px 10px", borderRadius: 8, background: "#fff", fontSize: 12 }}><strong style={{ color: log.eventType === "unlimited_activated" ? "#00877A" : "#c0392b" }}>{log.eventType === "unlimited_activated" ? "Activated" : "Deactivated"}</strong><span style={{ color: "#5A6A7A" }}> by {log.actor.name} · {formatDate(log.createdAt)}</span></div>) : <span style={{ color: "#5A6A7A", fontSize: 12 }}>No recorded changes.</span>}</div> : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
