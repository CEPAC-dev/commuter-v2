"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Wallet as WalletIcon, X } from "lucide-react";

interface Props {
  bookingId: string;
  amountEgp: number;
  walletBalance: number;
}

export default function ContinueCheckoutButton({
  bookingId,
  amountEgp,
  walletBalance,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<"card" | "wallet" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const walletAvail = Math.max(0, walletBalance);
  const walletPortion = Math.min(walletAvail, amountEgp);
  const cardPortion = Math.max(0, amountEgp - walletPortion);
  const walletCoversAll = walletPortion >= amountEgp && amountEgp > 0;
  const walletEnabled = walletAvail > 0;

  async function submit(useWallet: boolean) {
    setLoading(useWallet ? "wallet" : "card");
    setError(null);
    try {
      const res = await fetch("/api/payments/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, useWallet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment failed");
      if (data.walletOnly && data.redirect) {
        router.push(data.redirect);
        return;
      }
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
        return;
      }
      throw new Error("Unexpected response");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(null);
    }
  }

  return (
    <>
      {/* ── CTA button ── */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setError(null);
          setOpen(true);
        }}
        style={{
          display: "block",
          width: "100%",
          padding: "13px 16px",
          background: "#0B1E3D",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: "0.01em",
        }}
      >
        Continue to checkout
      </button>

      {/* ── Payment method sheet ── */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(11,30,61,0.5)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={() => {
            if (!loading) setOpen(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 480,
              padding: "24px 20px 44px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 22,
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#0B1E3D",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Choose payment method
                </h3>
                <p style={{ margin: "5px 0 0", fontSize: 13, color: "#5A6A7A" }}>
                  Amount due:{" "}
                  <strong style={{ color: "#0B1E3D" }}>{amountEgp} EGP</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  if (!loading) setOpen(false);
                }}
                disabled={loading !== null}
                aria-label="Close"
                style={{
                  background: "none",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  padding: 4,
                  marginTop: -2,
                }}
              >
                <X size={20} color="#5A6A7A" />
              </button>
            </div>

            {/* Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Card — Kashier */}
              <button
                onClick={() => submit(false)}
                disabled={loading !== null}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 18px",
                  background: loading === "card" ? "#f5f7fa" : "#fff",
                  border: "2px solid #0B1E3D",
                  borderRadius: 14,
                  cursor: loading !== null ? "not-allowed" : "pointer",
                  textAlign: "left",
                  opacity: loading !== null && loading !== "card" ? 0.45 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 11,
                    background: "#EBF0FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <CreditCard size={22} color="#0B1E3D" />
                </div>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 700,
                      fontSize: 15,
                      color: "#0B1E3D",
                    }}
                  >
                    Card
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 13, color: "#5A6A7A" }}>
                    {loading === "card"
                      ? "Redirecting…"
                      : `Pay via Kashier · ${amountEgp} EGP`}
                  </p>
                </div>
              </button>

              {/* Wallet */}
              <button
                onClick={walletEnabled ? () => submit(true) : undefined}
                disabled={loading !== null || !walletEnabled}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 18px",
                  background: loading === "wallet" ? "#f0faf9" : "#fff",
                  border: `2px solid ${walletEnabled ? "#00C2A8" : "#dde3ea"}`,
                  borderRadius: 14,
                  cursor:
                    loading !== null || !walletEnabled ? "not-allowed" : "pointer",
                  textAlign: "left",
                  opacity:
                    (loading !== null && loading !== "wallet") || !walletEnabled
                      ? 0.45
                      : 1,
                  transition: "opacity 0.15s",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 11,
                    background: "#E6FAF8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <WalletIcon size={22} color="#00C2A8" />
                </div>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 700,
                      fontSize: 15,
                      color: "#0B1E3D",
                    }}
                  >
                    {walletCoversAll
                      ? "Wallet"
                      : walletEnabled
                        ? "Wallet + Card"
                        : "Wallet"}
                  </p>
                  <p
                    style={{
                      margin: "3px 0 0",
                      fontSize: 13,
                      color: walletEnabled ? "#5A6A7A" : "#E74C3C",
                      fontWeight: !walletEnabled ? 600 : 400,
                    }}
                  >
                    {loading === "wallet"
                      ? "Processing…"
                      : !walletEnabled
                        ? `Balance: ${walletBalance} EGP · No funds`
                        : walletCoversAll
                          ? `Balance: ${walletBalance} EGP`
                          : `${walletPortion} EGP wallet + ${cardPortion} EGP card`}
                  </p>
                </div>
              </button>
            </div>

            {error && (
              <p
                style={{
                  marginTop: 18,
                  fontSize: 13,
                  color: "#E74C3C",
                  textAlign: "center",
                  fontWeight: 600,
                  padding: "10px 14px",
                  background: "#FFF0F0",
                  borderRadius: 10,
                }}
              >
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
