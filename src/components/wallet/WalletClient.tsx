"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Wallet as WalletIcon,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Loader2,
  Banknote,
  Landmark,
  Smartphone,
} from "lucide-react";

interface Tx {
  id: string;
  type: "topup" | "payment" | "refund" | "earning" | "withdrawal";
  amountEgp: number;
  status: "pending" | "completed" | "failed";
  description: string;
  balanceAfterEgp: number | null;
  createdAt: string;
}

interface WalletData {
  balanceEgp: number;
  status: string;
  role?: string;
  transactions: Tx[];
}

interface PayoutMethod {
  payoutMethod: "mobile_wallet" | "bank" | null;
  payoutMobile: string;
  payoutBankName: string;
  payoutAccountNumber: string;
  payoutAccountHolder: string;
}

const PRESETS = [50, 100, 200, 500];
const WITHDRAW_PRESETS = [100, 200, 500, 1000];

export default function WalletClient({ role: initialRole }: { role?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const topupId = params.get("topupId");

  const [data, setData] = useState<WalletData | null>(null);
  const [amount, setAmount] = useState<number>(100);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(200);
  const [busy, setBusy] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [error, setError] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  const [payoutError, setPayoutError] = useState("");
  const [notice, setNotice] = useState("");
  const [payout, setPayout] = useState<PayoutMethod>({
    payoutMethod: null,
    payoutMobile: "",
    payoutBankName: "",
    payoutAccountNumber: "",
    payoutAccountHolder: "",
  });
  const [payoutDraft, setPayoutDraft] = useState<PayoutMethod>({
    payoutMethod: "mobile_wallet",
    payoutMobile: "",
    payoutBankName: "",
    payoutAccountNumber: "",
    payoutAccountHolder: "",
  });

  const role = data?.role ?? initialRole ?? "passenger";
  const isDriver = role === "driver";

  const load = useCallback(async () => {
    const res = await fetch("/api/wallet", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  const loadPayoutMethod = useCallback(async () => {
    const res = await fetch("/api/wallet/payout-method", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    const next: PayoutMethod = {
      payoutMethod: json.payoutMethod ?? null,
      payoutMobile: json.payoutMobile ?? "",
      payoutBankName: json.payoutBankName ?? "",
      payoutAccountNumber: json.payoutAccountNumber ?? "",
      payoutAccountHolder: json.payoutAccountHolder ?? "",
    };
    setPayout(next);
    setPayoutDraft({
      ...next,
      payoutMethod: next.payoutMethod ?? "mobile_wallet",
    });
  }, []);

  // On return from Kashier: verify the pending top-up, then refresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (topupId) {
        setNotice("Confirming your top-up…");
        try {
          const res = await fetch("/api/wallet/topup/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topupId }),
          });
          const json = await res.json();
          if (!cancelled) {
            if (json.status === "paid")
              setNotice("Top-up added to your wallet.");
            else if (json.status === "failed")
              setNotice("Top-up failed. No charge was made.");
            else setNotice("Top-up is still processing. Refresh shortly.");
          }
        } catch {
          if (!cancelled)
            setNotice("Could not confirm top-up. Try refreshing.");
        }
        // Clean the URL so a refresh doesn't re-verify.
        router.replace("/wallet");
      }
      // Self-heal: settle any top-ups Kashier confirmed but we missed.
      if (!isDriver) {
        try {
          await fetch("/api/wallet/reconcile", { method: "POST" });
        } catch {
          /* non-fatal */
        }
      }
      await load();
      if (initialRole === "driver") {
        await loadPayoutMethod();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topupId]);

  async function handleTopup() {
    setError("");
    const amt = Math.round(Number(amount));
    if (!isFinite(amt) || amt < 10 || amt > 5000) {
      setError("Enter an amount between 10 and 5000 EGP.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not start top-up.");
        setBusy(false);
        return;
      }
      window.location.href = json.sessionUrl;
    } catch {
      setError("Network error. Please retry.");
      setBusy(false);
    }
  }

  async function handleSavePayoutMethod() {
    setPayoutError("");
    setPayoutBusy(true);
    try {
      const body =
        payoutDraft.payoutMethod === "mobile_wallet"
          ? {
              payoutMethod: "mobile_wallet",
              payoutMobile: payoutDraft.payoutMobile,
            }
          : {
              payoutMethod: "bank",
              payoutBankName: payoutDraft.payoutBankName,
              payoutAccountNumber: payoutDraft.payoutAccountNumber,
              payoutAccountHolder: payoutDraft.payoutAccountHolder,
            };
      const res = await fetch("/api/wallet/payout-method", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setPayoutError(json.error ?? "Could not save payout method.");
        return;
      }
      const next: PayoutMethod = {
        payoutMethod: json.payoutMethod,
        payoutMobile: json.payoutMobile ?? "",
        payoutBankName: json.payoutBankName ?? "",
        payoutAccountNumber: json.payoutAccountNumber ?? "",
        payoutAccountHolder: json.payoutAccountHolder ?? "",
      };
      setPayout(next);
      setPayoutDraft(next);
      setNotice("Payout method saved.");
    } catch {
      setPayoutError("Network error. Please retry.");
    } finally {
      setPayoutBusy(false);
    }
  }

  async function handleWithdraw() {
    setWithdrawError("");
    const amt = Math.round(Number(withdrawAmount));
    if (!isFinite(amt) || amt < 50 || amt > 10000) {
      setWithdrawError("Enter an amount between 50 and 10,000 EGP.");
      return;
    }
    if (!payout.payoutMethod) {
      setWithdrawError("Save a payout method first.");
      return;
    }
    setWithdrawBusy(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      const json = await res.json();
      if (!res.ok) {
        setWithdrawError(json.error ?? "Withdrawal failed.");
        return;
      }
      setNotice(json.message ?? "Withdrawal submitted.");
      await load();
    } catch {
      setWithdrawError("Network error. Please retry.");
    } finally {
      setWithdrawBusy(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #eef0f3",
    borderRadius: 14,
    padding: "18px",
    marginBottom: 24,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 48,
    borderRadius: 10,
    border: "1.5px solid #eef0f3",
    padding: "0 14px",
    fontSize: 15,
    fontFamily: "inherit",
    color: "#0B1E3D",
    marginBottom: 12,
    boxSizing: "border-box",
  };

  return (
    <main
      style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px 56px" }}
    >
      {/* Balance card */}
      <div
        style={{
          background: "linear-gradient(135deg, #0B1E3D 0%, #14315c 100%)",
          borderRadius: 18,
          padding: "24px 22px",
          color: "#fff",
          marginBottom: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: 0.8,
            marginBottom: 8,
          }}
        >
          <WalletIcon size={16} aria-hidden="true" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {isDriver ? "Earnings balance" : "Wallet balance"}
          </span>
        </div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {data ? `${data.balanceEgp} EGP` : "—"}
        </div>
      </div>

      {notice && (
        <p
          style={{
            fontSize: 13,
            color: "#0B1E3D",
            background: "#E8F5E9",
            border: "1px solid #c8e6c9",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 16,
          }}
        >
          {notice}
        </p>
      )}

      {isDriver ? (
        <>
          <section style={cardStyle}>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "#0B1E3D",
                margin: "0 0 14px",
              }}
            >
              Payout method
            </h2>
            <p style={{ fontSize: 13, color: "#5A6A7A", margin: "0 0 14px" }}>
              Where Kashier sends your withdrawals (mobile wallet or bank).
            </p>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(
                [
                  ["mobile_wallet", "Mobile wallet", Smartphone],
                  ["bank", "Bank account", Landmark],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setPayoutDraft((p) => ({ ...p, payoutMethod: key }))
                  }
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 10,
                    border:
                      payoutDraft.payoutMethod === key
                        ? "1.5px solid #00C2A8"
                        : "1.5px solid #eef0f3",
                    background:
                      payoutDraft.payoutMethod === key
                        ? "rgba(0,194,168,0.08)"
                        : "#fff",
                    color: "#0B1E3D",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            {payoutDraft.payoutMethod === "mobile_wallet" ? (
              <input
                type="tel"
                placeholder="01xxxxxxxxx"
                value={payoutDraft.payoutMobile}
                onChange={(e) =>
                  setPayoutDraft((p) => ({
                    ...p,
                    payoutMobile: e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 11),
                  }))
                }
                aria-label="Mobile wallet number"
                style={inputStyle}
              />
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Bank name"
                  value={payoutDraft.payoutBankName}
                  onChange={(e) =>
                    setPayoutDraft((p) => ({
                      ...p,
                      payoutBankName: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Account number"
                  value={payoutDraft.payoutAccountNumber}
                  onChange={(e) =>
                    setPayoutDraft((p) => ({
                      ...p,
                      payoutAccountNumber: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Account holder name"
                  value={payoutDraft.payoutAccountHolder}
                  onChange={(e) =>
                    setPayoutDraft((p) => ({
                      ...p,
                      payoutAccountHolder: e.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </>
            )}

            {payoutError && (
              <p style={{ fontSize: 13, color: "#e74c3c", margin: "0 0 12px" }}>
                {payoutError}
              </p>
            )}

            <button
              type="button"
              onClick={handleSavePayoutMethod}
              disabled={payoutBusy}
              style={{
                width: "100%",
                height: 46,
                borderRadius: 12,
                border: "none",
                background: payoutBusy ? "#5A6A7A" : "#00C2A8",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: payoutBusy ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {payoutBusy ? "Saving…" : "Save payout method"}
            </button>
          </section>

          <section style={cardStyle}>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "#0B1E3D",
                margin: "0 0 14px",
              }}
            >
              Withdraw earnings
            </h2>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              {WITHDRAW_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setWithdrawAmount(p)}
                  style={{
                    flex: "1 1 0",
                    minWidth: 64,
                    height: 42,
                    borderRadius: 10,
                    border:
                      withdrawAmount === p
                        ? "1.5px solid #00C2A8"
                        : "1.5px solid #eef0f3",
                    background:
                      withdrawAmount === p ? "rgba(0,194,168,0.08)" : "#fff",
                    color: "#0B1E3D",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            <input
              type="number"
              min={50}
              max={10000}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(Number(e.target.value))}
              aria-label="Withdrawal amount in EGP"
              style={inputStyle}
            />

            {withdrawError && (
              <p style={{ fontSize: 13, color: "#e74c3c", margin: "0 0 12px" }}>
                {withdrawError}
              </p>
            )}

            <button
              type="button"
              onClick={handleWithdraw}
              disabled={withdrawBusy || !payout.payoutMethod}
              style={{
                width: "100%",
                height: 50,
                borderRadius: 12,
                border: "none",
                background:
                  withdrawBusy || !payout.payoutMethod ? "#5A6A7A" : "#0B1E3D",
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                cursor:
                  withdrawBusy || !payout.payoutMethod
                    ? "not-allowed"
                    : "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {withdrawBusy ? (
                <Loader2 size={18} className="spin" aria-hidden="true" />
              ) : (
                <Banknote size={18} aria-hidden="true" />
              )}
              {withdrawBusy
                ? "Processing…"
                : `Withdraw ${withdrawAmount} EGP via Kashier`}
            </button>
          </section>
        </>
      ) : (
        <section style={cardStyle}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#0B1E3D",
              margin: "0 0 14px",
            }}
          >
            Add funds
          </h2>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(p)}
                style={{
                  flex: "1 1 0",
                  minWidth: 64,
                  height: 42,
                  borderRadius: 10,
                  border:
                    amount === p
                      ? "1.5px solid #00C2A8"
                      : "1.5px solid #eef0f3",
                  background: amount === p ? "rgba(0,194,168,0.08)" : "#fff",
                  color: "#0B1E3D",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {p}
              </button>
            ))}
          </div>

          <input
            type="number"
            min={10}
            max={5000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            aria-label="Top-up amount in EGP"
            style={inputStyle}
          />

          {error && (
            <p style={{ fontSize: 13, color: "#e74c3c", margin: "0 0 12px" }}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleTopup}
            disabled={busy}
            style={{
              width: "100%",
              height: 50,
              borderRadius: 12,
              border: "none",
              background: busy ? "#5A6A7A" : "#0B1E3D",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              cursor: busy ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {busy ? (
              <Loader2 size={18} className="spin" aria-hidden="true" />
            ) : (
              <Plus size={18} aria-hidden="true" />
            )}
            {busy ? "Redirecting…" : `Charge ${amount} EGP`}
          </button>
        </section>
      )}

      {/* Ledger */}
      <h2
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: "#0B1E3D",
          margin: "0 0 12px",
        }}
      >
        History
      </h2>

      {!data ? (
        <p style={{ fontSize: 14, color: "#5A6A7A" }}>Loading…</p>
      ) : data.transactions.length === 0 ? (
        <p style={{ fontSize: 14, color: "#5A6A7A" }}>No transactions yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.transactions.map((t) => {
            const isCredit =
              t.type === "topup" || t.type === "refund" || t.type === "earning";
            const Icon =
              t.type === "topup" || t.type === "earning"
                ? ArrowDownLeft
                : t.type === "refund"
                  ? RotateCcw
                  : t.type === "withdrawal"
                    ? Banknote
                    : ArrowUpRight;
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "#fff",
                  border: "1px solid #eef0f3",
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isCredit ? "#E8F5E9" : "#FFF3E0",
                    color: isCredit ? "#27AE60" : "#E65100",
                  }}
                >
                  <Icon size={16} aria-hidden="true" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "#0B1E3D",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {t.description}
                  </div>
                  <div style={{ fontSize: 12, color: "#5A6A7A" }}>
                    {new Date(t.createdAt).toLocaleString("en-EG", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {t.status !== "completed" ? ` · ${t.status}` : ""}
                  </div>
                </div>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 14,
                    fontVariantNumeric: "tabular-nums",
                    color: isCredit ? "#27AE60" : "#FF2C2C",
                  }}
                >
                  {isCredit ? "+" : "−"}
                  {t.amountEgp}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <style>{`.spin { animation: spin 0.7s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
