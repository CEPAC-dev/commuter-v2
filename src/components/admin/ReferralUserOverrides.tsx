"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, UserCheck, ShieldAlert, Infinity } from "lucide-react";
import { useClientLocale } from "@/lib/i18n/client";

interface SearchUserResult {
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
}

export default function ReferralUserOverrides() {
  const { t } = useClientLocale();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<SearchUserResult[]>([]);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setUsers([]);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const timer = setTimeout(() => {
      fetch(`/api/admin/users/search?q=${encodeURIComponent(trimmed)}`)
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Search failed.");
          setUsers(json.data ?? []);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Search failed.");
        })
        .finally(() => {
          setLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  async function toggleUnlimited(user: SearchUserResult) {
    setTogglingId(user.id);
    const nextState = !user.referralUnlimited;

    try {
      const res = await fetch(`/api/admin/users/${user.id}/referral-unlimited`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlimited: nextState }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update user.");

      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, referralUnlimited: nextState } : u,
        ),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <section
      style={{
        background: "#ffffff",
        borderRadius: 16,
        border: "1px solid #eef0f3",
        padding: 24,
        marginTop: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(11,30,61,0.08)",
            color: "#0B1E3D",
          }}
        >
          <Infinity size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: "#0B1E3D" }}>
            Unlimited Referral Usage Overrides
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#5A6A7A" }}>
            Search users by exact User # (e.g. <code>#3</code>) or Name / Phone to bypass referral limits.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 14px",
            height: 46,
            background: "#f8f9fa",
            borderRadius: 10,
            border: "1.5px solid #e8edf0",
          }}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" style={{ color: "#00C2A8", flexShrink: 0 }} aria-hidden="true" />
          ) : (
            <Search size={18} style={{ color: "#5A6A7A", flexShrink: 0 }} aria-hidden="true" />
          )}
          <input
            type="text"
            placeholder="Search by exact User # (e.g. #3) or Name / Phone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              border: 0,
              background: "transparent",
              outline: "none",
              fontSize: 14,
              fontFamily: "inherit",
              color: "#0B1E3D",
            }}
          />
        </div>
        <p style={{ fontSize: 12, color: "#8896A5", margin: "6px 4px 0" }}>
          Tip: Prefix with <strong>#</strong> for exact User # search (e.g. <code>#3</code> finds user #3 only). Auto-searches as you type.
        </p>
      </div>

      {error ? (
        <p role="alert" style={{ color: "#e74c3c", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      ) : null}

      {users.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #eef0f3", textAlign: "left" }}>
                <th style={{ padding: "10px 12px", color: "#5A6A7A" }}>User #</th>
                <th style={{ padding: "10px 12px", color: "#5A6A7A" }}>Name / Phone</th>
                <th style={{ padding: "10px 12px", color: "#5A6A7A" }}>Role</th>
                <th style={{ padding: "10px 12px", color: "#5A6A7A" }}>Referral Code</th>
                <th style={{ padding: "10px 12px", color: "#5A6A7A" }}>Usage / Cap</th>
                <th style={{ padding: "10px 12px", color: "#5A6A7A" }}>Unlimited Cap</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #f0f3f6" }}>
                  <td style={{ padding: "12px", fontWeight: 700, color: "#0B1E3D" }}>
                    #{u.userNumber ?? "N/A"}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <div style={{ fontWeight: 600, color: "#0B1E3D" }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: "#5A6A7A" }}>{u.phone}</div>
                  </td>
                  <td style={{ padding: "12px", textTransform: "capitalize", color: "#5A6A7A" }}>
                    {u.role}
                  </td>
                  <td style={{ padding: "12px", fontFamily: "monospace", fontWeight: 600 }}>
                    {u.referralCode ?? "—"}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: u.referralUnlimited
                          ? "#00877A"
                          : u.usageCount >= u.maxUsersPerCode
                            ? "#e74c3c"
                            : "#0B1E3D",
                      }}
                    >
                      {u.usageCount} / {u.referralUnlimited ? "∞" : u.maxUsersPerCode}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <button
                      type="button"
                      onClick={() => toggleUnlimited(u)}
                      disabled={togglingId === u.id}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 8,
                        border: u.referralUnlimited
                          ? "1px solid #00C2A8"
                          : "1px solid #dcdfe4",
                        background: u.referralUnlimited
                          ? "rgba(0,194,168,0.1)"
                          : "#f8f9fa",
                        color: u.referralUnlimited ? "#00877A" : "#5A6A7A",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: togglingId === u.id ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontFamily: "inherit",
                      }}
                    >
                      {togglingId === u.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : u.referralUnlimited ? (
                        <UserCheck size={14} />
                      ) : (
                        <ShieldAlert size={14} />
                      )}
                      {u.referralUnlimited ? "Unlimited ON" : "Unlimited OFF"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : query && !loading ? (
        <p style={{ color: "#5A6A7A", fontSize: 14, margin: "12px 0 0" }}>
          No matching users found for &quot;{query}&quot;.
        </p>
      ) : null}
    </section>
  );
}
