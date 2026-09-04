"use client";

import { useState } from "react";
import { Check, Loader2, ShieldQuestion } from "lucide-react";
import PasswordInput from "@/components/shared/PasswordInput";
import PasswordStrengthMeter from "@/components/shared/PasswordStrengthMeter";
import {
  isStrongPassword,
  PASSWORD_RULES_MESSAGE,
} from "@/lib/auth/validation";
import { useVerificationConfig } from "@/lib/auth/useVerificationConfig";
import { useClientLocale } from "@/lib/i18n/client";

export default function ChangePasswordSection() {
  const { t } = useClientLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { method: verificationMethod } = useVerificationConfig();

  async function sendCode() {
    setSendingCode(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "password_change" }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.error ?? t("otp.send_verification_error_fallback"),
        );
      setCodeSent(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t("otp.send_verification_error_fallback"),
      );
    } finally {
      setSendingCode(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (!isStrongPassword(newPassword)) return setError(PASSWORD_RULES_MESSAGE);
    if (newPassword !== confirmPassword)
      return setError(t("change_password.mismatch"));
    if (verificationMethod === "security_question") {
      if (securityAnswer.trim().length < 2)
        return setError(t("security_question.enter_answer_error"));
    } else if (!/^\d{6}$/.test(otp)) {
      return setError(t("otp.enter_code_error"));
    }

    setSaving(true);
    try {
      const body =
        verificationMethod === "security_question"
          ? {
              newPassword,
              confirmPassword,
              securityAnswer: securityAnswer.trim(),
            }
          : { newPassword, confirmPassword, otp };
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? t("change_password.update_failed"));
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
      setSecurityAnswer("");
      setCodeSent(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t("change_password.update_failed"),
      );
    } finally {
      setSaving(false);
    }
  }

  const canSubmitSecurity =
    verificationMethod === "security_question" &&
    securityAnswer.trim().length >= 2;
  const canSubmitOtp = verificationMethod === "sms_otp" && otp.length === 6;

  return (
    <section
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #eef0f3",
        padding: 24,
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <h2
          style={{ fontSize: 15, fontWeight: 700, color: "#0B1E3D", margin: 0 }}
        >
          {t("profile.change_password")}
        </h2>
        <span style={{ fontSize: 14, color: "#00C2A8", fontWeight: 700 }}>
          {isOpen
            ? t("change_password.toggle_hide")
            : t("change_password.toggle_change")}
        </span>
      </button>

      {isOpen && (
        <form
          onSubmit={handleSubmit}
          noValidate
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: 18,
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#5A6A7A",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {verificationMethod === "security_question"
              ? t("security_question.confirm_change_hint")
              : t("otp.change_password_hint")}
          </p>
          <PasswordInput
            label={t("change_password.new")}
            id="cp-new"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <PasswordStrengthMeter password={newPassword} />
          <PasswordInput
            label={t("change_password.confirm")}
            id="cp-confirm"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {verificationMethod === "security_question" ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0B1E3D",
                }}
              >
                <ShieldQuestion size={14} aria-hidden="true" />{" "}
                {t("security_question.answer_label_with_icon")}
              </span>
              <input
                value={securityAnswer}
                onChange={(e) =>
                  setSecurityAnswer(e.target.value.slice(0, 120))
                }
                autoComplete="off"
                placeholder={t("security_question.your_answer_placeholder")}
                required
                style={{
                  height: 48,
                  borderRadius: 10,
                  border: "1.5px solid #d0d8e0",
                  padding: "0 14px",
                  fontSize: 15,
                  fontFamily: "inherit",
                }}
              />
            </label>
          ) : (
            codeSent && (
              <input
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t("otp.code_placeholder_full")}
                aria-label={t("otp.code_placeholder_full")}
                required
                style={{
                  height: 48,
                  borderRadius: 10,
                  border: "1.5px solid #d0d8e0",
                  padding: "0 14px",
                  fontSize: 15,
                  letterSpacing: 3,
                  fontFamily: "inherit",
                }}
              />
            )
          )}

          {error && (
            <p
              role="alert"
              style={{ fontSize: 13, color: "#e74c3c", margin: 0 }}
            >
              {error}
            </p>
          )}
          {success && (
            <p
              role="status"
              style={{
                fontSize: 13,
                color: "#27AE60",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Check size={14} aria-hidden="true" />
              {t("change_password.updated")}
            </p>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {verificationMethod === "sms_otp" && (
              <button
                type="button"
                onClick={sendCode}
                disabled={sendingCode || saving}
                style={buttonStyle("secondary", sendingCode || saving)}
              >
                {sendingCode && <Loader2 size={16} className="animate-spin" />}
                {codeSent
                  ? t("otp.resend_code_short")
                  : t("otp.send_code_short")}
              </button>
            )}
            {(canSubmitSecurity || canSubmitOtp) && (
              <button
                type="submit"
                disabled={saving}
                style={buttonStyle("primary", saving)}
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {t("change_password.update")}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

function buttonStyle(
  variant: "primary" | "secondary",
  disabled: boolean,
): React.CSSProperties {
  return {
    height: 48,
    padding: "0 18px",
    background: variant === "primary" ? "#0B1E3D" : "#fff",
    color: variant === "primary" ? "#fff" : "#0B1E3D",
    fontWeight: 700,
    fontSize: 14,
    border: variant === "primary" ? "none" : "1.5px solid #d0d8e0",
    borderRadius: 10,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
}
