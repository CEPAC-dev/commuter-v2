"use client";

import { useState } from "react";
import { Check, Loader2, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useVerificationConfig } from "@/lib/auth/useVerificationConfig";
import { useClientLocale } from "@/lib/i18n/client";

export default function PhoneVerificationCard({
  initialVerified,
}: {
  initialVerified: boolean;
}) {
  const router = useRouter();
  const { t } = useClientLocale();
  const { method: verificationMethod, loading: configLoading } =
    useVerificationConfig();
  const [verified, setVerified] = useState(initialVerified);
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState<"send" | "verify" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  async function sendCode() {
    setLoading("send");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "phone_verification" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("otp.send_error_fallback"));
      setSent(true);
      setMessage({
        ok: true,
        text: t("otp.sent_notice"),
      });
    } catch (error) {
      setMessage({
        ok: false,
        text:
          error instanceof Error ? error.message : t("otp.send_error_fallback"),
      });
    } finally {
      setLoading(null);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading("verify");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? t("otp.verify_error_fallback"));
      setVerified(true);
      setOtp("");
      setMessage({ ok: true, text: t("phone_verification.verified_notice") });
      router.refresh();
    } catch (error) {
      setMessage({
        ok: false,
        text:
          error instanceof Error
            ? error.message
            : t("otp.verify_error_fallback"),
      });
    } finally {
      setLoading(null);
    }
  }

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #eef0f3",
        borderRadius: 16,
        padding: 24,
      }}
    >
      {configLoading ? null : verificationMethod === "security_question" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: "#eef2f5",
              color: "#5A6A7A",
            }}
          >
            <Phone size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 style={{ margin: 0, color: "#0B1E3D", fontSize: 15 }}>
              {t("phone_verification.title")}
            </h2>
            <p style={{ margin: "3px 0 0", color: "#5A6A7A", fontSize: 13 }}>
              {t("phone_verification.disabled_hint")}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: verified ? 0 : 14,
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background: verified ? "rgba(0,194,168,0.12)" : "#eef2f5",
                color: verified ? "#00877A" : "#5A6A7A",
              }}
            >
              {verified ? (
                <Check size={18} aria-hidden="true" />
              ) : (
                <Phone size={18} aria-hidden="true" />
              )}
            </span>
            <div>
              <h2 style={{ margin: 0, color: "#0B1E3D", fontSize: 15 }}>
                {t("phone_verification.title")}
              </h2>
              <p
                style={{
                  margin: "3px 0 0",
                  color: verified ? "#00877A" : "#5A6A7A",
                  fontSize: 13,
                }}
              >
                {verified
                  ? t("phone_verification.verified_status")
                  : t("phone_verification.unverified_hint")}
              </p>
            </div>
          </div>

          {!verified && (
            <form
              onSubmit={verifyCode}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              {sent && (
                <input
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={t("otp.code_placeholder_short")}
                  aria-label={t("otp.code_placeholder_full")}
                  required
                  style={{
                    height: 44,
                    borderRadius: 9,
                    border: "1.5px solid #d0d8e0",
                    padding: "0 12px",
                    fontSize: 15,
                    letterSpacing: 3,
                    fontFamily: "inherit",
                  }}
                />
              )}
              {message && (
                <p
                  role={message.ok ? "status" : "alert"}
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: message.ok ? "#00877A" : "#c0392b",
                  }}
                >
                  {message.text}
                </p>
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={loading !== null}
                  style={buttonStyle("secondary", loading !== null)}
                >
                  {loading === "send" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : null}
                  {sent ? t("otp.resend_code_short") : t("otp.send_code_short")}
                </button>
                {sent && (
                  <button
                    type="submit"
                    disabled={loading !== null || otp.length !== 6}
                    style={buttonStyle(
                      "primary",
                      loading !== null || otp.length !== 6,
                    )}
                  >
                    {loading === "verify" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : null}
                    {t("phone_verification.verify_button")}
                  </button>
                )}
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}

function buttonStyle(
  variant: "primary" | "secondary",
  disabled: boolean,
): React.CSSProperties {
  return {
    height: 42,
    padding: "0 14px",
    borderRadius: 9,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    border: variant === "primary" ? "none" : "1.5px solid #d0d8e0",
    background: variant === "primary" ? "#0B1E3D" : "#fff",
    color: variant === "primary" ? "#fff" : "#0B1E3D",
    fontWeight: 700,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
  };
}
