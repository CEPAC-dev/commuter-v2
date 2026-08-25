"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";

interface Transaction {
  id: string;
  type: string;
  status: string;
  amountEgp: number;
  description: string;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
  bookingId: string | null;
  paymentId: string | null;
  tripId: string | null;
  kashierOrderId: string | null;
  kashierTransactionIds: string[];
  payment: {
    totalEgp: number;
    walletAmountEgp: number;
    gatewayAmountEgp: number;
    overallStatus: string;
  } | null;
}

interface ReportSummary {
  completed: {
    walletVolumeEgp: number;
    kashierVolumeEgp: number;
    totalCollectedEgp: number;
    paidPaymentsCount: number;
  };
  refunds: { totalRefundedEgp: number; refundCount: number };
  inflight: {
    reservedEgp: number;
    reservationCount: number;
    pendingTxCount: number;
  };
  failures: { failedTxCount: number };
  net: { netCollectedEgp: number };
}

const STATUS_COLORS: Record<string, string> = {
  completed: "#00877A",
  pending: "#E8A33D",
  failed: "#E74C3C",
};

const TYPES = [
  "topup",
  "payment",
  "kashier_payment",
  "refund",
  "earning",
  "referral_bonus",
  "withdrawal",
  "payment_reserved",
  "payment_released",
  "payment_captured",
  "payment_refund_partial",
];

export default function TransactionsClient({
  canExport,
  canRefund: _canRefund,
  canReports,
}: {
  canExport: boolean;
  canRefund: boolean;
  canReports: boolean;
}) {
  void _canRefund;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [method, setMethod] = useState<"" | "wallet" | "kashier" | "mixed">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ReportSummary | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    for (const s of statusFilter) p.append("status", s);
    for (const t of typeFilter) p.append("type", t);
    if (method) p.set("paymentMethod", method);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    if (minAmount) p.set("minAmount", minAmount);
    if (maxAmount) p.set("maxAmount", maxAmount);
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p.toString();
  }, [
    search,
    statusFilter,
    typeFilter,
    method,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    page,
    limit,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/transactions?${qs}`, {
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to load");
      setRows(d.transactions);
      setTotal(d.total);
      setPages(d.pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!canReports) return;
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    fetch(`/api/admin/transactions/reports?${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setReport(d))
      .catch(() => {});
  }, [dateFrom, dateTo, canReports]);

  function toggle(list: string[], setter: (v: string[]) => void, val: string) {
    setter(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
    setPage(1);
  }

  const kpi = (
    label: string,
    value: string,
    sub?: string,
    color = "#0B1E3D",
  ) => (
    <div
      style={{
        background: "#fff",
        border: "1px solid #eef0f3",
        borderRadius: 12,
        padding: "14px 16px",
        flex: 1,
        minWidth: 160,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#5A6A7A",
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color,
          fontVariantNumeric: "tabular-nums",
          marginTop: 4,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "#5A6A7A", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );

  return (
    <main
      style={{
        padding: 24,
        background: "#F6F8F7",
        minHeight: "100dvh",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <Link
              href="/admin/dashboard"
              style={{ fontSize: 12, color: "#5A6A7A", textDecoration: "none" }}
            >
              ← Dashboard
            </Link>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: "#0B1E3D",
                margin: "4px 0 0",
              }}
            >
              Transactions
            </h1>
          </div>
          {canExport && (
            <a
              href={`/api/admin/transactions/export?${qs}`}
              style={{
                padding: "10px 16px",
                background: "#0B1E3D",
                color: "#fff",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              Export CSV
            </a>
          )}
        </div>

        {canReports && report && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {kpi(
              "Total collected",
              `${report.completed.totalCollectedEgp} EGP`,
              `${report.completed.paidPaymentsCount} payments`,
              "#00877A",
            )}
            {kpi(
              "Wallet portion",
              `${report.completed.walletVolumeEgp} EGP`,
              "captured",
              "#0B1E3D",
            )}
            {kpi(
              "Kashier portion",
              `${report.completed.kashierVolumeEgp} EGP`,
              "settled",
              "#0B1E3D",
            )}
            {kpi(
              "Refunded",
              `${report.refunds.totalRefundedEgp} EGP`,
              `${report.refunds.refundCount} refunds`,
              "#E74C3C",
            )}
            {kpi(
              "Net collected",
              `${report.net.netCollectedEgp} EGP`,
              "collected − refunded",
              "#00877A",
            )}
            {kpi(
              "Reserved (inflight)",
              `${report.inflight.reservedEgp} EGP`,
              `${report.inflight.reservationCount} holds — NOT revenue`,
              "#E8A33D",
            )}
            {kpi(
              "Pending",
              String(report.inflight.pendingTxCount),
              "unsettled",
              "#E8A33D",
            )}
            {kpi(
              "Failed",
              String(report.failures.failedTxCount),
              "",
              "#E74C3C",
            )}
          </div>
        )}

        {/* Filter bar */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #eef0f3",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search id, payment id, kashier ref, user name/email/phone…"
              style={{
                padding: "10px 12px",
                border: "1.5px solid #eef0f3",
                borderRadius: 8,
                fontSize: 13,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: "1.5px solid #eef0f3",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: "1.5px solid #eef0f3",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <input
                type="number"
                placeholder="Min EGP"
                value={minAmount}
                onChange={(e) => {
                  setMinAmount(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: 100,
                  padding: "10px 12px",
                  border: "1.5px solid #eef0f3",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <input
                type="number"
                placeholder="Max EGP"
                value={maxAmount}
                onChange={(e) => {
                  setMaxAmount(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: 100,
                  padding: "10px 12px",
                  border: "1.5px solid #eef0f3",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <FilterGroup
              label="Status"
              items={["completed", "pending", "failed"]}
              selected={statusFilter}
              onToggle={(v) => toggle(statusFilter, setStatusFilter, v)}
            />
            <FilterGroup
              label="Type"
              items={TYPES}
              selected={typeFilter}
              onToggle={(v) => toggle(typeFilter, setTypeFilter, v)}
            />
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#5A6A7A",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Method
              </div>
              <select
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value as typeof method);
                  setPage(1);
                }}
                style={{
                  padding: "6px 10px",
                  border: "1.5px solid #eef0f3",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
                <option value="">Any</option>
                <option value="wallet">Wallet</option>
                <option value="kashier">Kashier</option>
                <option value="mixed">Mixed (with Payment)</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              color: "#E74C3C",
              padding: 12,
              background: "rgba(231,76,60,0.08)",
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* Table */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #eef0f3",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Amount</Th>
                  <Th>User</Th>
                  <Th>Payment split</Th>
                  <Th>Description</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: 24,
                        textAlign: "center",
                        color: "#5A6A7A",
                      }}
                    >
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: 24,
                        textAlign: "center",
                        color: "#5A6A7A",
                      }}
                    >
                      No transactions
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((tx) => (
                    <tr key={tx.id} style={{ borderTop: "1px solid #eef0f3" }}>
                      <Td>{new Date(tx.createdAt).toLocaleString()}</Td>
                      <Td>
                        <code style={{ fontSize: 11 }}>{tx.type}</code>
                      </Td>
                      <Td>
                        <StatusPill status={tx.status} />
                      </Td>
                      <Td
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 700,
                        }}
                      >
                        {tx.amountEgp} EGP
                      </Td>
                      <Td>
                        {tx.userName ?? "—"}
                        <div style={{ fontSize: 11, color: "#5A6A7A" }}>
                          {tx.userEmail ?? tx.userPhone ?? tx.userId}
                        </div>
                      </Td>
                      <Td>
                        {tx.payment ? (
                          <span style={{ fontSize: 11, color: "#5A6A7A" }}>
                            W {tx.payment.walletAmountEgp} + K{" "}
                            {tx.payment.gatewayAmountEgp} ={" "}
                            {tx.payment.totalEgp}
                          </span>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td
                        style={{
                          maxWidth: 260,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tx.description}
                      </Td>
                      <Td>
                        <Link
                          href={`/admin/transactions/${tx.id}`}
                          style={{
                            color: "#00C2A8",
                            fontWeight: 700,
                            textDecoration: "none",
                          }}
                        >
                          View →
                        </Link>
                      </Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              borderTop: "1px solid #eef0f3",
              fontSize: 12,
              color: "#5A6A7A",
            }}
          >
            <span>
              {total} transactions · page {page} of {pages}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                style={pageBtn(page <= 1)}
              >
                Prev
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
                style={pageBtn(page >= pages)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "10px 12px",
        fontSize: 11,
        fontWeight: 700,
        color: "#5A6A7A",
        textTransform: "uppercase",
        letterSpacing: 0.4,
      }}
    >
      {children}
    </th>
  );
}
function Td({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td style={{ padding: "10px 12px", color: "#0B1E3D", ...style }}>
      {children}
    </td>
  );
}
function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#5A6A7A";
  return (
    <span
      style={{
        background: `${color}22`,
        color,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}
function FilterGroup({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#5A6A7A",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {items.map((it) => (
          <button
            key={it}
            onClick={() => onToggle(it)}
            style={{
              padding: "4px 8px",
              background: selected.includes(it) ? "#0B1E3D" : "#fff",
              color: selected.includes(it) ? "#fff" : "#5A6A7A",
              border: "1.5px solid #eef0f3",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {it}
          </button>
        ))}
      </div>
    </div>
  );
}
function pageBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    background: disabled ? "#eef0f3" : "#0B1E3D",
    color: disabled ? "#9aa8b5" : "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
