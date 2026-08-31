"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  AdminCard,
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
  AdminPageContainer,
  AdminPageHeader,
  AdminPagination,
  AdminStatusBadge,
  AdminTable,
} from "@/components/admin/layout";
import { AdminTopbarActions } from "@/components/admin/layout/AdminShell";

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
    color = "var(--color-primary)",
  ) => (
    <AdminCard padding="14px 16px" style={{ flex: 1, minWidth: 160 }}>
      <div
        style={{
          fontSize: 11,
          color: "var(--color-muted)",
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
        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </AdminCard>
  );

  return (
    <AdminPageContainer maxWidth={1400}>
      <AdminPageHeader
        title="Transactions"
        description="Review payment activity, settlement status, and transaction history."
      />
      {canExport ? (
        <AdminTopbarActions>
            <a
              href={`/api/admin/transactions/export?${qs}`}
              style={{
                padding: "10px 16px",
                background: "var(--color-primary)",
                color: "var(--color-on-primary)",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              Export CSV
            </a>
        </AdminTopbarActions>
      ) : null}

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
              "var(--color-secondary-deep)",
            )}
            {kpi(
              "Wallet portion",
              `${report.completed.walletVolumeEgp} EGP`,
              "captured",
              "var(--color-primary)",
            )}
            {kpi(
              "Kashier portion",
              `${report.completed.kashierVolumeEgp} EGP`,
              "settled",
              "var(--color-primary)",
            )}
            {kpi(
              "Refunded",
              `${report.refunds.totalRefundedEgp} EGP`,
              `${report.refunds.refundCount} refunds`,
              "var(--color-danger)",
            )}
            {kpi(
              "Net collected",
              `${report.net.netCollectedEgp} EGP`,
              "collected − refunded",
              "var(--color-secondary-deep)",
            )}
            {kpi(
              "Reserved (inflight)",
              `${report.inflight.reservedEgp} EGP`,
              `${report.inflight.reservationCount} holds — NOT revenue`,
              "var(--color-accent)",
            )}
            {kpi(
              "Pending",
              String(report.inflight.pendingTxCount),
              "unsettled",
              "var(--color-accent)",
            )}
            {kpi(
              "Failed",
              String(report.failures.failedTxCount),
              "",
              "var(--color-danger)",
            )}
          </div>
        )}

        {/* Filter bar */}
        <AdminCard padding={16}>
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
                border: "1.5px solid var(--color-border)",
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
                  border: "1.5px solid var(--color-border)",
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
                  border: "1.5px solid var(--color-border)",
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
                  border: "1.5px solid var(--color-border)",
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
                  border: "1.5px solid var(--color-border)",
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
                  color: "var(--color-muted)",
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
                  border: "1.5px solid var(--color-border)",
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
        </AdminCard>

        {error ? <AdminErrorState title="Unable to load transactions" description={error} /> : null}

        {/* Table */}
        <AdminCard padding={0}>
          <AdminTable ariaLabel="Transactions">
              <thead>
                <tr style={{ background: "var(--color-surface)", textAlign: "left" }}>
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
                        color: "var(--color-muted)",
                      }}
                    >
                      <AdminLoadingState title="Loading transactions..." />
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
                        color: "var(--color-muted)",
                      }}
                    >
                      <AdminEmptyState title="No transactions" description="No transactions match the current filters." />
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((tx) => (
                    <tr key={tx.id} style={{ borderTop: "1px solid var(--color-border)" }}>
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
                        <div style={{ fontSize: 11, color: "var(--color-muted)" }}>
                          {tx.userEmail ?? tx.userPhone ?? tx.userId}
                        </div>
                      </Td>
                      <Td>
                        {tx.payment ? (
                          <span style={{ fontSize: 11, color: "var(--color-muted)" }}>
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
                            color: "var(--color-secondary)",
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
          </AdminTable>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              borderTop: "1px solid var(--color-border)",
              fontSize: 12,
              color: "var(--color-muted)",
            }}
          >
            <span>
              {total} transactions · page {page} of {pages}
            </span>
            <AdminPagination page={page} totalPages={pages} onPageChange={setPage} />
          </div>
        </AdminCard>
    </AdminPageContainer>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "10px 12px",
        fontSize: 11,
        fontWeight: 700,
        color: "var(--color-muted)",
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
    <td style={{ padding: "10px 12px", color: "var(--color-primary)", ...style }}>
      {children}
    </td>
  );
}
function StatusPill({ status }: { status: string }) {
  return <AdminStatusBadge status={status} />;
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
          color: "var(--color-muted)",
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
              background: selected.includes(it) ? "var(--color-primary)" : "var(--color-panel)",
              color: selected.includes(it) ? "var(--color-on-primary)" : "var(--color-muted)",
              border: "1.5px solid var(--color-border)",
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
