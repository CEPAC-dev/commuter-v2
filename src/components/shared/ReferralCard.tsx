"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Share2, WalletCards } from "lucide-react";
import { useClientLocale } from "@/lib/i18n/client";

interface ReferralData {
  referralCode: string;
  shareUrl: string;
  balanceEgp: number;
  referrerBonusAmount: number;
  stats: {
    total: number;
    pending: number;
    credited: number;
  };
}

export default function ReferralCard() {
  const { t } = useClientLocale();
  const [data, setData] = useState<ReferralData | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/referral/my-code")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? t("referral.load_failed"));
        if (!cancelled) setData(result.data);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t("referral.load_failed"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function copyLink() {
    if (!data) return;
    await navigator.clipboard.writeText(data.shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function shareLink() {
    if (!data) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: t("referral.share_title"),
          text: t("referral.share_text"),
          url: data.shareUrl,
        });
        return;
      } catch (shareError) {
        if ((shareError as Error).name === "AbortError") return;
      }
    }
    await copyLink();
  }

  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #eef0f3",
        borderRadius: 16,
        padding: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,194,168,0.12)",
            color: "#00877A",
          }}
        >
          <WalletCards size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, color: "#0B1E3D" }}>
            {t("referral.title")}
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "#5A6A7A" }}>
            {t("referral.description").replace(
              "{amount}",
              String(data?.referrerBonusAmount ?? 0),
            )}
          </p>
        </div>
      </div>

      {!data && !error ? (
        <div style={{ minHeight: 52, display: "flex", alignItems: "center", color: "#5A6A7A" }}>
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        </div>
      ) : null}
      {error ? <p role="alert" style={{ margin: 0, color: "#e74c3c", fontSize: 13 }}>{error}</p> : null}
      {data ? (
        <>
          <div
            dir="ltr"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              minHeight: 52,
              padding: "0 14px",
              background: "#f8f9fa",
              border: "1px solid #e8edf0",
              borderRadius: 10,
            }}
          >
            <strong style={{ color: "#0B1E3D", letterSpacing: 0 }}>{data.referralCode}</strong>
            <button
              type="button"
              onClick={copyLink}
              title={t("referral.copy_link")}
              aria-label={t("referral.copy_link")}
              style={{ border: 0, background: "transparent", color: "#00877A", cursor: "pointer", padding: 8 }}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button type="button" onClick={copyLink} style={buttonStyle("#0B1E3D")}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? t("referral.copied") : t("referral.copy_link")}
            </button>
            <button type="button" onClick={shareLink} style={buttonStyle("#00C2A8")}>
              <Share2 size={16} /> {t("referral.share")}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function buttonStyle(background: string): React.CSSProperties {
  return {
    minHeight: 44,
    padding: "0 16px",
    border: 0,
    borderRadius: 10,
    background,
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "inherit",
  };
}