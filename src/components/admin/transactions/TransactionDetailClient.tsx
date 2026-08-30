"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AdminCard,
  AdminErrorState,
  AdminLoadingState,
  AdminPageContainer,
  AdminPageHeader,
  AdminStatusBadge,
} from "@/components/admin/layout";

interface DetailData {
  transaction: {
    id: string;
    type: string;
    status: string;
    amountEgp: number;
    description: string;
    balanceAfterEgp: number | null;
    createdAt: string;
    kashierOrderId: string | null;
    kashierTransactionIds: string[];
  };
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
  } | null;
  booking: {
    id: string | null;
    amountEgp: number;
    paymentStatus: string;
    status: string;
    dates: string[];
    note: string;
  } | null;
  payment: {
    id: string;
    totalEgp: number;
    walletAmountEgp: number;
    gatewayAmountEgp: number;
    walletStatus: string;
    gatewayStatus: string;
    overallStatus: string;
    paidAt: string | null;
    refundedAt: string | null;
    refundedAmountEgp: number;
    kashierSessionId: string | null;
    kashierOrderId: string | null;
    kashierTransactionIds: string[];
    kashierRefundIds: string[];
  } | null;
  ledger: {
    id: string;
    type: string;
    status: string;
    amountEgp: number;
    description: string;
    balanceAfterEgp: number | null;
    createdAt: string;
  }[];
  timeline: { at: string; event: string; detail?: string; ref?: string }[];
}

export default function TransactionDetailClient({
  id,
  canRefund,
}: {
  id: string;
  canRefund: boolean;
}) {
  const [data, setData] = useState<DetailData | null>(null);
  const [error, setError] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [refundResult, setRefundResult] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/transactions/${id}`, {
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function submitRefund() {
    if (!data?.payment) return;
    setRefunding(true);
    setRefundResult("");
    try {
      const r = await fetch("/api/admin/transactions/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: data.payment.id,
          amountEgp: Number(refundAmount),
          reason: refundReason || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Refund failed");
      setRefundResult(
        `Refunded ${j.refundedAmountEgp} EGP (wallet ${j.walletRefundEgp}, kashier ${j.gatewayRefundEgp}). ${j.gatewayRefundFailed ? "⚠ Kashier portion failed — manual action required." : ""}`,
      );
      await load();
    } catch (e) {
      setRefundResult(e instanceof Error ? e.message : String(e));
    } finally {
      setRefunding(false);
    }
  }

  if (error) return <AdminPageContainer maxWidth={1000}><AdminErrorState title="Unable to load transaction" description={error} /></AdminPageContainer>;
  if (!data) return <AdminPageContainer maxWidth={1000}><AdminLoadingState title="Loading transaction..." /></AdminPageContainer>;

  const p = data.payment;
  const canDoRefund =
    canRefund &&
    p &&
    (p.overallStatus === "paid" || p.overallStatus === "partially_refunded");
  const maxRefundable = p ? p.totalEgp - (p.refundedAmountEgp ?? 0) : 0;

  return (
    <AdminPageContainer maxWidth={1000}>
        <AdminPageHeader
          title={`Transaction ${data.transaction.id}`}
          breadcrumb={<Link href="/admin/transactions" style={{ fontSize: 12, color: "var(--color-muted)", textDecoration: "none" }}>Transactions / Details</Link>}
        />

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <Section title="Transaction">
            <Row k="Type" v={<code>{data.transaction.type}</code>} />
            <Row k="Status" v={<AdminStatusBadge status={data.transaction.status} />} />
            <Row k="Amount" v={`${data.transaction.amountEgp} EGP`} />
            <Row k="Description" v={data.transaction.description} />
            <Row
              k="Balance after"
              v={data.transaction.balanceAfterEgp ?? "—"}
            />
            <Row
              k="Created"
              v={new Date(data.transaction.createdAt).toLocaleString()}
            />
          </Section>

          <Section title="User">
            {data.user ? (
              <>
                <Row k="Name" v={data.user.name} />
                <Row k="Email" v={data.user.email ?? "—"} />
                <Row k="Phone" v={data.user.phone ?? "—"} />
                <Row k="Role" v={data.user.role} />
              </>
            ) : (
              "—"
            )}
          </Section>

          {p && (
            <Section title="Payment (aggregate)" full>
              <Row k="Payment id" v={<code>{p.id}</code>} />
              <Row k="Total" v={`${p.totalEgp} EGP`} />
              <Row
                k="Wallet portion"
                v={`${p.walletAmountEgp} EGP — ${p.walletStatus}`}
              />
              <Row
                k="Kashier portion"
                v={`${p.gatewayAmountEgp} EGP — ${p.gatewayStatus}`}
              />
              <Row k="Overall status" v={<AdminStatusBadge status={p.overallStatus} />} />
              <Row
                k="Paid at"
                v={p.paidAt ? new Date(p.paidAt).toLocaleString() : "—"}
              />
              <Row
                k="Refunded"
                v={`${p.refundedAmountEgp} EGP${p.refundedAt ? ` at ${new Date(p.refundedAt).toLocaleString()}` : ""}`}
              />
              <Row k="Kashier session" v={p.kashierSessionId ?? "—"} />
              <Row k="Kashier order" v={p.kashierOrderId ?? "—"} />
              <Row
                k="Kashier txns"
                v={(p.kashierTransactionIds ?? []).join(", ") || "—"}
              />
              <Row
                k="Kashier refunds"
                v={(p.kashierRefundIds ?? []).join(", ") || "—"}
              />
            </Section>
          )}

          {data.booking && (
            <Section title="Booking" full>
              <Row k="Booking id" v={<code>{data.booking.id}</code>} />
              <Row k="Amount" v={`${data.booking.amountEgp} EGP`} />
              <Row k="Payment status" v={<AdminStatusBadge status={data.booking.paymentStatus} />} />
              <Row k="Status" v={<AdminStatusBadge status={data.booking.status} />} />
              <Row k="Dates" v={(data.booking.dates ?? []).join(", ")} />
              <Row k="Note" v={data.booking.note || "—"} />
            </Section>
          )}

          <Section title="Related ledger rows" full>
            {data.ledger.length === 0 && (
              <div style={{ color: "var(--color-muted)" }}>No related rows</div>
            )}
            {data.ledger.map((l) => (
              <div
                key={l.id}
                style={{
                  padding: "8px 0",
                  borderBottom: "1px solid var(--color-border)",
                  fontSize: 13,
                }}
              >
                <code style={{ fontSize: 11 }}>{l.type}</code> · {l.status} ·{" "}
                <strong>{l.amountEgp} EGP</strong> ·{" "}
                {new Date(l.createdAt).toLocaleString()}
                <div style={{ color: "var(--color-muted)", fontSize: 12 }}>
                  {l.description}
                </div>
              </div>
            ))}
          </Section>

          <Section title="Timeline" full>
            {data.timeline.length === 0 && (
              <div style={{ color: "var(--color-muted)" }}>No timeline</div>
            )}
            {data.timeline.map((ev, i) => (
              <div
                key={i}
                style={{
                  padding: "6px 0",
                  fontSize: 13,
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <span style={{ color: "var(--color-muted)", fontSize: 11 }}>
                  {new Date(ev.at).toLocaleString()}
                </span>
                {" · "}
                <code style={{ fontSize: 11 }}>{ev.event}</code>
                {ev.detail && (
                  <span style={{ color: "var(--color-muted)" }}> — {ev.detail}</span>
                )}
              </div>
            ))}
          </Section>

          {canDoRefund && (
            <Section title="Issue refund" full>
              <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 8 }}>
                Refundable remaining:{" "}
                <strong style={{ color: "var(--color-primary)" }}>
                  {maxRefundable} EGP
                </strong>
                . Wallet portion is refunded first, then Kashier.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  min={1}
                  max={maxRefundable}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="Amount EGP"
                  style={{
                    padding: "8px 10px",
                    border: "1.5px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 13,
                    width: 140,
                  }}
                />
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Reason"
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    border: "1.5px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                />
                <button
                  disabled={refunding || !refundAmount}
                  onClick={submitRefund}
                  style={{
                    padding: "8px 16px",
                    background:
                      refunding || !refundAmount ? "var(--color-muted)" : "var(--color-danger)",
                    color: "var(--color-on-primary)",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor:
                      refunding || !refundAmount ? "not-allowed" : "pointer",
                  }}
                >
                  {refunding ? "Refunding…" : "Refund"}
                </button>
              </div>
              {refundResult && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--color-primary)" }}>
                  {refundResult}
                </div>
              )}
            </Section>
          )}
        </div>
    </AdminPageContainer>
  );
}

function Section({
  title,
  children,
  full,
}: {
  title: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <AdminCard padding={16} style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--color-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.4,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </AdminCard>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "4px 0",
        fontSize: 13,
      }}
    >
      <span style={{ color: "var(--color-muted)" }}>{k}</span>
      <span
        style={{
          color: "var(--color-primary)",
          fontWeight: 600,
          textAlign: "right",
          wordBreak: "break-all",
        }}
      >
        {v}
      </span>
    </div>
  );
}
