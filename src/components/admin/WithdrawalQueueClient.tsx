"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Search,
  AlertTriangle,
  Settings,
} from "lucide-react";
import {
  AdminCard,
  AdminEmptyState,
  AdminLoadingState,
  AdminStatusBadge,
  AdminTable,
} from "@/components/admin/layout";

interface WalletContext {
  balanceEgp: number;
  reserveAmount: number;
  pendingWithdrawalAmount: number;
  withdrawableEgp: number;
  withdrawalLimit?: number | null;
}

interface WithdrawalItem {
  id: string;
  driverId: string;
  driverName: string;
  driverEmail: string;
  driverPhone: string;
  amountEgp: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  payoutMethod: "mobile_wallet" | "bank";
  payoutDestination: string;
  rejectionReason?: string | null;
  requestedAt: string;
  resolvedAt?: string | null;
  wallet: WalletContext;
}

export default function WithdrawalQueueClient() {
  const [requests, setRequests] = useState<WithdrawalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // Reject modal state
  const [rejectModalItem, setRejectModalItem] = useState<WithdrawalItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Override modal state
  const [overrideModalDriver, setOverrideModalDriver] = useState<{
    driverId: string;
    driverName: string;
    reserveAmount: number;
    withdrawalLimit: string;
  } | null>(null);

  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const url = statusFilter ? `/api/admin/withdrawals?status=${statusFilter}` : "/api/admin/withdrawals";
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setRequests(json.requests ?? []);
      }
    } catch {
      setNotice({ type: "error", text: "Failed to load withdrawal requests." });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRequests();
  }, [fetchRequests]);

  async function handleApprove(item: WithdrawalItem) {
    if (!confirm(`Approve withdrawal of ${item.amountEgp} EGP for ${item.driverName}?`)) return;
    setActionBusyId(item.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/withdrawals/${item.id}/approve`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "error", text: json.error || "Approval failed." });
      } else {
        setNotice({ type: "success", text: `Approved withdrawal of ${item.amountEgp} EGP for ${item.driverName}.` });
        await fetchRequests();
      }
    } catch {
      setNotice({ type: "error", text: "Network error approving request." });
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleConfirmReject() {
    if (!rejectModalItem) return;
    setActionBusyId(rejectModalItem.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/withdrawals/${rejectModalItem.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "error", text: json.error || "Rejection failed." });
      } else {
        setNotice({ type: "success", text: `Rejected withdrawal request of ${rejectModalItem.amountEgp} EGP.` });
        setRejectModalItem(null);
        setRejectReason("");
        await fetchRequests();
      }
    } catch {
      setNotice({ type: "error", text: "Network error rejecting request." });
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleSaveOverrides() {
    if (!overrideModalDriver) return;
    setActionBusyId(overrideModalDriver.driverId);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/drivers/${overrideModalDriver.driverId}/wallet-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reserveAmount: Number(overrideModalDriver.reserveAmount),
          withdrawalLimit:
            overrideModalDriver.withdrawalLimit.trim() === ""
              ? null
              : Number(overrideModalDriver.withdrawalLimit),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "error", text: json.error || "Failed to update driver settings." });
      } else {
        setNotice({ type: "success", text: `Updated wallet settings for ${overrideModalDriver.driverName}.` });
        setOverrideModalDriver(null);
        await fetchRequests();
      }
    } catch {
      setNotice({ type: "error", text: "Network error updating driver settings." });
    } finally {
      setActionBusyId(null);
    }
  }

  const filteredRequests = requests.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.driverName.toLowerCase().includes(q) ||
      r.driverEmail.toLowerCase().includes(q) ||
      r.driverPhone.toLowerCase().includes(q) ||
      r.payoutDestination.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {notice && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            background: notice.type === "success" ? "var(--color-success-tint)" : "var(--color-danger-tint)",
            color: notice.type === "success" ? "var(--color-success)" : "var(--color-danger)",
            border: `1px solid ${notice.type === "success" ? "var(--color-success)" : "var(--color-danger)"}`,
          }}
        >
          {notice.text}
        </div>
      )}

      {/* Toolbar & Filters */}
      <AdminCard padding="16px 20px">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            ["pending", "Pending Queue"],
            ["approved", "Approved"],
            ["rejected", "Rejected"],
            ["cancelled", "Cancelled"],
            ["", "All Requests"],
          ].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setStatusFilter(val)}
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                border: statusFilter === val ? "1.5px solid var(--color-secondary)" : "1.5px solid var(--color-border)",
                background: statusFilter === val ? "var(--color-secondary-tint)" : "var(--color-panel)",
                color: statusFilter === val ? "var(--color-primary)" : "var(--color-muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, width: 260 }}>
          <Search size={16} style={{ color: "var(--color-muted)", marginLeft: 8 }} />
          <input
            type="text"
            placeholder="Search driver name, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              height: 38,
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              padding: "0 10px",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
        </div>
        </div>
      </AdminCard>

      {/* Queue Table */}
      <AdminCard padding={0}>
        {loading ? (
          <AdminLoadingState title="Loading withdrawal requests..." />
        ) : filteredRequests.length === 0 ? (
          <AdminEmptyState title="No withdrawal requests" description="No requests match the current status and search filters." />
        ) : (
          <AdminTable ariaLabel="Withdrawal requests">
              <thead>
                <tr style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", color: "var(--color-muted)", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.05em" }}>
                  <th style={{ padding: "12px 16px" }}>Driver</th>
                  <th style={{ padding: "12px 16px" }}>Requested Amount</th>
                  <th style={{ padding: "12px 16px" }}>Wallet State (Balance / Reserve / Pending / Withdrawable)</th>
                  <th style={{ padding: "12px 16px" }}>Payout Destination</th>
                  <th style={{ padding: "12px 16px" }}>Date</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((r) => {
                  const isPending = r.status === "pending";
                  const isBusy = actionBusyId === r.id;

                  // Balance check warning if balance dropped below requested amount while pending
                  const balanceShortage = r.wallet.balanceEgp < r.amountEgp;

                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, color: "var(--color-primary)" }}>{r.driverName}</div>
                        <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{r.driverPhone || r.driverEmail}</div>
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <strong style={{ fontSize: 16, color: "var(--color-primary)" }}>{r.amountEgp} EGP</strong>
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <span>Balance: <strong>{r.wallet.balanceEgp}</strong></span>
                          <span>Reserve: <strong>{r.wallet.reserveAmount}</strong></span>
                          <span>Pending: <strong style={{ color: "var(--color-accent)" }}>{r.wallet.pendingWithdrawalAmount}</strong></span>
                          <span>Withdrawable: <strong style={{ color: "var(--color-secondary)" }}>{r.wallet.withdrawableEgp}</strong></span>
                        </div>
                        {r.wallet.withdrawalLimit != null && (
                          <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                            Limit: {r.wallet.withdrawalLimit} EGP
                          </div>
                        )}
                        {isPending && balanceShortage && (
                          <div style={{ fontSize: 11, color: "var(--color-danger)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                            <AlertTriangle size={12} />
                            Shortage! Driver balance ({r.wallet.balanceEgp} EGP) is below request.
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 600, color: "var(--color-primary)" }}>{r.payoutDestination}</div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", textTransform: "capitalize" }}>{r.payoutMethod.replace("_", " ")}</div>
                      </td>

                      <td style={{ padding: "14px 16px", color: "var(--color-muted)", fontSize: 12 }}>
                        {new Date(r.requestedAt).toLocaleString()}
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <AdminStatusBadge status={r.status} />
                        {r.rejectionReason && (
                          <div style={{ fontSize: 11, color: "var(--color-danger)", marginTop: 4 }}>
                            {r.rejectionReason}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApprove(r)}
                                disabled={isBusy || balanceShortage}
                                title={balanceShortage ? "Driver balance is insufficient to approve" : "Approve payout"}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                  border: "none",
                                  background: isBusy || balanceShortage ? "var(--color-muted)" : "var(--color-secondary)",
                                  color: "var(--color-on-primary)",
                                  fontWeight: 700,
                                  fontSize: 12,
                                  cursor: isBusy || balanceShortage ? "not-allowed" : "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <CheckCircle2 size={14} />
                                Approve
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setRejectModalItem(r);
                                  setRejectReason("");
                                }}
                                disabled={isBusy}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                  border: "1px solid var(--color-border)",
                                  background: "var(--color-panel)",
                                  color: "var(--color-danger)",
                                  fontWeight: 700,
                                  fontSize: 12,
                                  cursor: isBusy ? "not-allowed" : "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <XCircle size={14} />
                                Reject
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setOverrideModalDriver({
                                driverId: r.driverId,
                                driverName: r.driverName,
                                reserveAmount: r.wallet.reserveAmount,
                                withdrawalLimit:
                                  r.wallet.withdrawalLimit != null ? String(r.wallet.withdrawalLimit) : "",
                              })
                            }
                            title="Configure Driver Reserve & Limit Overrides"
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid var(--color-border)",
                              background: "var(--color-surface)",
                              color: "var(--color-primary)",
                              fontSize: 12,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Settings size={14} />
                            Overrides
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
          </AdminTable>
        )}
      </AdminCard>

      {/* Reject Reason Modal */}
      {rejectModalItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--color-overlay)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--color-panel)",
              borderRadius: 16,
              padding: 24,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 40px var(--color-shadow-strong)",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "var(--color-primary)" }}>
              Reject Withdrawal Request
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--color-muted)" }}>
              Rejecting request of <strong>{rejectModalItem.amountEgp} EGP</strong> for {rejectModalItem.driverName}. The held amount will be released back to the driver&apos;s withdrawable balance.
            </p>

            <textarea
              placeholder="Reason for rejection (optional)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1.5px solid var(--color-border)",
                padding: "10px 12px",
                fontSize: 14,
                fontFamily: "inherit",
                color: "var(--color-primary)",
                marginBottom: 16,
                boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-panel)",
                  color: "var(--color-muted)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "var(--color-danger)",
                  color: "var(--color-on-primary)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Wallet Overrides Modal */}
      {overrideModalDriver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--color-overlay)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--color-panel)",
              borderRadius: 16,
              padding: 24,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 40px var(--color-shadow-strong)",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "var(--color-primary)" }}>
              Driver Wallet Overrides
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--color-muted)" }}>
              Configure custom reserve floor and withdrawal limit ceiling for <strong>{overrideModalDriver.driverName}</strong>.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-primary)", marginBottom: 6 }}>
                Reserve Amount Floor (EGP)
              </label>
              <input
                type="number"
                min="0"
                value={overrideModalDriver.reserveAmount}
                onChange={(e) =>
                  setOverrideModalDriver((prev) => prev && { ...prev, reserveAmount: Number(e.target.value) })
                }
                style={{
                  width: "100%",
                  height: 42,
                  borderRadius: 10,
                  border: "1.5px solid var(--color-border)",
                  padding: "0 12px",
                  fontSize: 14,
                  fontFamily: "inherit",
                  color: "var(--color-primary)",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-primary)", marginBottom: 6 }}>
                Withdrawal Limit Ceiling (EGP, leave empty for global default)
              </label>
              <input
                type="number"
                min="1"
                placeholder="Global default"
                value={overrideModalDriver.withdrawalLimit}
                onChange={(e) =>
                  setOverrideModalDriver((prev) => prev && { ...prev, withdrawalLimit: e.target.value })
                }
                style={{
                  width: "100%",
                  height: 42,
                  borderRadius: 10,
                  border: "1.5px solid var(--color-border)",
                  padding: "0 12px",
                  fontSize: 14,
                  fontFamily: "inherit",
                  color: "var(--color-primary)",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setOverrideModalDriver(null)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-panel)",
                  color: "var(--color-muted)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOverrides}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "var(--color-secondary)",
                  color: "var(--color-on-primary)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Save Overrides
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
