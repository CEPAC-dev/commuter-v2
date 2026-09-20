"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Search, UserPlus, Infinity, XCircle } from "lucide-react";

type Snapshot = { name: string; userNumber: number | null; phone: string };
type ReferralGroup = {
  id: string;
  createdAt: string;
  actorUserId: string;
  actor: Snapshot;
  targets: Snapshot[];
};
type UnlimitedLog = {
  id: string;
  targetUserId: string;
  eventType: "unlimited_activated" | "unlimited_deactivated";
  createdAt: string;
  actor: Snapshot;
  target: Snapshot;
};
type UnlimitedUserGroup = {
  id: string;
  target: Snapshot;
  latest: UnlimitedLog;
  logs: UnlimitedLog[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function UserLine({ user }: { user: Snapshot }) {
  return (
    <li style={{ display: "flex", flexWrap: "wrap", gap: 6, color: "#0B1E3D" }}>
      <strong>{user.name}</strong>
      <span>— User #{user.userNumber ?? "N/A"}</span>
      <span>— {user.phone}</span>
    </li>
  );
}

export default function ReferralAuditHistory() {
  const [referralAdded, setReferralAdded] = useState<ReferralGroup[]>([]);
  const [unlimitedActivated, setUnlimitedActivated] = useState<UnlimitedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [referralSearch, setReferralSearch] = useState("");
  const [unlimitedSearch, setUnlimitedSearch] = useState("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [expandedReferrers, setExpandedReferrers] = useState<Set<string>>(new Set());
  const [referralSort, setReferralSort] = useState<"date" | "count">("date");
  const [referralDirection, setReferralDirection] = useState<"asc" | "desc">("desc");

  function matchesUserSearch(user: Snapshot, value: string) {
    const query = value.trim();
    if (!query) return true;
    if (query.startsWith("#")) {
      const number = query.slice(1).trim();
      return /^\d+$/.test(number) && String(user.userNumber ?? "") === number;
    }
    return user.name.toLowerCase().includes(query.toLowerCase());
  }

  const referralGroups = useMemo(() => {
    const filtered = referralAdded.filter((group) => matchesUserSearch(group.actor, referralSearch));
    return [...filtered].sort((a, b) => {
      const left = referralSort === "count" ? a.targets.length : new Date(a.createdAt).getTime();
      const right = referralSort === "count" ? b.targets.length : new Date(b.createdAt).getTime();
      return (left - right) * (referralDirection === "asc" ? 1 : -1);
    });
  }, [referralAdded, referralSearch, referralSort, referralDirection]);

  const unlimitedUsers = useMemo<UnlimitedUserGroup[]>(() => {
    const groups = new Map<string, UnlimitedUserGroup>();
    for (const log of unlimitedActivated) {
      const existing = groups.get(log.targetUserId);
      if (existing) {
        existing.logs.push(log);
        if (new Date(log.createdAt).getTime() > new Date(existing.latest.createdAt).getTime()) {
          existing.latest = log;
          existing.target = log.target;
        }
      } else {
        groups.set(log.targetUserId, { id: log.targetUserId, target: log.target, latest: log, logs: [log] });
      }
    }
    return Array.from(groups.values())
      .filter((group) => matchesUserSearch(group.target, unlimitedSearch))
      .sort((a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime());
  }, [unlimitedActivated, unlimitedSearch]);

  function toggleUser(userId: string) {
    setExpandedUsers((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleReferrer(userId: string) {
    setExpandedReferrers((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  useEffect(() => {
    const loadHistory = () => fetch("/api/admin/referral-settings/history")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load referral history.");
        setReferralAdded(result.referralAdded ?? []);
        setUnlimitedActivated(result.unlimitedActivated ?? []);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load referral history."))
      .finally(() => setLoading(false));

    loadHistory();
    window.addEventListener("referral-audit-changed", loadHistory);
    return () => window.removeEventListener("referral-audit-changed", loadHistory);
  }, []);

  return (
    <section style={{ marginTop: 24, display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, color: "#0B1E3D", fontSize: 20 }}>Referral history</h2>
        <p style={{ margin: "4px 0 0", color: "#5A6A7A", fontSize: 13 }}>
          Audit trail for successful referrals and Unlimited Referral activations.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#5A6A7A" }}><Loader2 size={17} className="animate-spin" /> Loading history...</div>
      ) : error ? (
        <p role="alert" style={{ margin: 0, color: "#e74c3c" }}>{error}</p>
      ) : (
        <>
          <HistoryCard title="Referral additions" icon={<UserPlus size={18} />} empty="No referral additions recorded yet." hasItems={referralAdded.length > 0}>
            <div style={{ padding: 14, borderBottom: "1px solid #eef0f3", background: "#fbfdfd", display: "grid", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <Search size={16} aria-hidden="true" style={{ position: "absolute", left: 12, top: 12, color: "#5A6A7A" }} />
                <input value={referralSearch} onChange={(event) => setReferralSearch(event.target.value)} placeholder="Search referrer by name or exact #User number..." aria-label="Search referral additions" style={{ width: "100%", boxSizing: "border-box", height: 40, padding: "0 12px 0 36px", border: "1px solid #dfe8e7", borderRadius: 9, background: "#fff", color: "#0B1E3D", outline: "none", fontSize: 13 }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#5A6A7A", fontSize: 12 }}>Sort by</span>
                <select value={referralSort} onChange={(event) => setReferralSort(event.target.value as "date" | "count")} style={{ height: 34, border: "1px solid #dfe8e7", borderRadius: 8, padding: "0 8px", color: "#0B1E3D", background: "#fff", fontSize: 12 }}>
                  <option value="date">Latest date</option>
                  <option value="count">People added</option>
                </select>
                <select value={referralDirection} onChange={(event) => setReferralDirection(event.target.value as "asc" | "desc")} style={{ height: 34, border: "1px solid #dfe8e7", borderRadius: 8, padding: "0 8px", color: "#0B1E3D", background: "#fff", fontSize: 12 }}>
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
                <span style={{ marginLeft: "auto", color: "#5A6A7A", fontSize: 12 }}>{referralGroups.length} referrer{referralGroups.length === 1 ? "" : "s"}</span>
              </div>
            </div>
            {referralGroups.length === 0 ? <p style={{ margin: 0, padding: 16, color: "#5A6A7A", fontSize: 13 }}>No referrers match your search.</p> : referralGroups.map((entry) => {
              const expanded = expandedReferrers.has(entry.actorUserId);
              return <div key={entry.actorUserId} style={{ borderBottom: "1px solid #eef0f3" }}>
                <button type="button" onClick={() => toggleReferrer(entry.actorUserId)} aria-expanded={expanded} style={{ width: "100%", border: 0, background: expanded ? "#f7fbfa" : "#fff", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                  <span style={{ width: 38, height: 38, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(0,194,168,0.14)", color: "#00877A" }}><UserPlus size={18} /></span>
                  <span style={{ minWidth: 0, flex: 1 }}><strong style={{ display: "block", color: "#0B1E3D", fontSize: 14 }}>{entry.actor.name}</strong><span style={{ display: "block", marginTop: 3, color: "#5A6A7A", fontSize: 12 }}>User #{entry.actor.userNumber ?? "N/A"} · {entry.actor.phone}</span></span>
                  <span style={{ textAlign: "right", flexShrink: 0 }}><strong style={{ display: "block", color: "#00877A", fontSize: 12 }}>{entry.targets.length} {entry.targets.length === 1 ? "person" : "people"}</strong><time dateTime={entry.createdAt} style={{ display: "block", marginTop: 3, color: "#5A6A7A", fontSize: 11 }}>{formatDate(entry.createdAt)}</time></span>
                  <ChevronDown size={17} style={{ flexShrink: 0, color: "#5A6A7A", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                </button>
                {expanded ? <ul style={{ margin: 0, padding: "0 16px 14px 66px", display: "grid", gap: 6, fontSize: 13 }}>{entry.targets.map((target, index) => <UserLine key={`${entry.actorUserId}-${index}`} user={target} />)}</ul> : null}
              </div>;
            })}
          </HistoryCard>

          <HistoryCard title="Unlimited Referral changes" icon={<Infinity size={18} />} empty="No Unlimited Referral changes recorded yet." hasItems={unlimitedActivated.length > 0}>
            <div style={{ padding: 14, borderBottom: "1px solid #eef0f3", background: "#fbfdfd" }}>
              <div style={{ position: "relative" }}>
                <Search size={16} aria-hidden="true" style={{ position: "absolute", left: 12, top: 12, color: "#5A6A7A" }} />
                <input
                  value={unlimitedSearch}
                  onChange={(event) => setUnlimitedSearch(event.target.value)}
                  placeholder="Search by user name or exact #User number..."
                  aria-label="Search Unlimited Referral users"
                  style={{ width: "100%", boxSizing: "border-box", height: 40, padding: "0 12px 0 36px", border: "1px solid #dfe8e7", borderRadius: 9, background: "#fff", color: "#0B1E3D", outline: "none", fontSize: 13 }}
                />
              </div>
              <p style={{ margin: "7px 2px 0", color: "#5A6A7A", fontSize: 12 }}>{unlimitedUsers.length} user{unlimitedUsers.length === 1 ? "" : "s"}, newest change first</p>
            </div>
            {unlimitedUsers.length === 0 ? (
              <p style={{ margin: 0, padding: 16, color: "#5A6A7A", fontSize: 13 }}>No users match your search.</p>
            ) : unlimitedUsers.map((group) => {
              const expanded = expandedUsers.has(group.id);
              return (
                <div key={group.id} style={{ borderBottom: "1px solid #eef0f3" }}>
                  <button type="button" onClick={() => toggleUser(group.id)} aria-expanded={expanded} style={{ width: "100%", border: 0, background: expanded ? "#f7fbfa" : "#fff", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                    <span style={{ width: 38, height: 38, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: group.latest.eventType === "unlimited_activated" ? "rgba(0,194,168,0.14)" : "rgba(231,76,60,0.1)", color: group.latest.eventType === "unlimited_activated" ? "#00877A" : "#c0392b" }}>
                      {group.latest.eventType === "unlimited_activated" ? <CheckCircle2 size={19} /> : <XCircle size={19} />}
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ display: "block", color: "#0B1E3D", fontSize: 14 }}>{group.target.name}</strong>
                      <span style={{ display: "block", marginTop: 3, color: "#5A6A7A", fontSize: 12 }}>User #{group.target.userNumber ?? "N/A"} · {group.target.phone}</span>
                    </span>
                    <span style={{ textAlign: "right", flexShrink: 0 }}>
                      <strong style={{ display: "block", color: group.latest.eventType === "unlimited_activated" ? "#00877A" : "#c0392b", fontSize: 12 }}>{group.latest.eventType === "unlimited_activated" ? "Active" : "Deactivated"}</strong>
                      <time dateTime={group.latest.createdAt} style={{ display: "block", marginTop: 3, color: "#5A6A7A", fontSize: 11 }}>{formatDate(group.latest.createdAt)}</time>
                    </span>
                    <ChevronDown size={17} style={{ flexShrink: 0, color: "#5A6A7A", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                  </button>
                  {expanded ? <div style={{ padding: "0 16px 14px 66px", display: "grid", gap: 8 }}>{[...group.logs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((entry) => <div key={entry.id} style={{ padding: "9px 10px", borderRadius: 8, background: "#f8fafa", fontSize: 12 }}><strong style={{ color: entry.eventType === "unlimited_activated" ? "#00877A" : "#c0392b" }}>{entry.eventType === "unlimited_activated" ? "Activated" : "Deactivated"}</strong><span style={{ color: "#5A6A7A" }}> by {entry.actor.name} · {formatDate(entry.createdAt)}</span></div>)}</div> : null}
                </div>
              );
            })}
          </HistoryCard>
        </>
      )}
    </section>
  );
}

function HistoryCard({
  title,
  icon,
  empty,
  hasItems,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  hasItems: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #eef0f3", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: "1px solid #eef0f3", color: "#00877A" }}>
        {icon}<h3 style={{ margin: 0, color: "#0B1E3D", fontSize: 15 }}>{title}</h3>
      </div>
      {hasItems ? children : <p style={{ margin: 0, padding: 16, color: "#5A6A7A", fontSize: 13 }}>{empty}</p>}
    </div>
  );
}
