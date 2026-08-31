"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Lock, Phone, Eye, EyeOff, Globe } from "lucide-react";
import Image from "next/image";
import { isStrongPassword } from "@/lib/auth/validation";
import PasswordStrengthMeter from "@/components/shared/PasswordStrengthMeter";
import { useClientLocale, setLocaleCookie } from "@/lib/i18n/client";
import { localeDirection } from "@/lib/i18n/config";

type Role = "passenger" | "driver";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t, locale } = useClientLocale();
  const [isPending, startTransition] = useTransition();

  const [role, setRole] = useState<Role>("passenger");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function toggleLanguage() {
    const next = locale === "en" ? "ar" : "en";
    setLocaleCookie(next);
    startTransition(() => router.refresh());
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    fontSize: 15,
    fontFamily: "inherit",
    color: "#0B1E3D",
    minWidth: 0,
  };

  const fieldStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
    height: 52,
    background: "#f8f9fa",
    borderRadius: 12,
    border: "1.5px solid #e8edf0",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  const focusField = (el: HTMLDivElement) => {
    el.style.borderColor = "#00C2A8";
    el.style.boxShadow = "0 0 0 3px rgba(0,194,168,0.12)";
  };

  const blurField = (el: HTMLDivElement) => {
    el.style.borderColor = "#e8edf0";
    el.style.boxShadow = "none";
  };

  async function handleSendCode() {
    setError("");
    setSuccess("");
    if (!phone.trim()) {
      setError(t("auth.phone_required"));
      return;
    }
    setSendingCode(true);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "password_reset", phone: phone.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("auth.something_went_wrong"));
      setCodeSent(true);
      setSuccess("A verification code was sent to your phone.");
    } catch (error) {
      setError(error instanceof Error ? error.message : t("auth.something_went_wrong"));
    } finally {
      setSendingCode(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!phone.trim()) {
      setError(t("auth.phone_required"));
      return;
    }

    if (!isStrongPassword(newPassword)) {
      setError(t("auth.password_weak"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("auth.passwords_do_not_match"));
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        phone: phone.trim(),
        role,
        newPassword,
        confirmPassword,
        otp,
      };

      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("auth.something_went_wrong"));
        setLoading(false);
        return;
      }

      setSuccess(t("auth.password_updated_success"));
      setTimeout(() => router.replace("/login"), 1200);
    } catch {
      setError(t("auth.network_error"));
    } finally {
      setLoading(false);
    }
  }

  const roleLabel = role === "passenger" 
    ? (locale === "ar" ? "الراكب" : "passenger") 
    : (locale === "ar" ? "السائق" : "driver");

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(140deg, #0B1E3D 0%, #1C3557 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        direction: localeDirection(locale),
      }}
    >
      <div style={{ width: "100%", maxWidth: 440, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link
          href="/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "rgba(255,255,255,0.6)",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 500,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.6)";
          }}
        >
          <ArrowLeft size={16} aria-hidden="true" style={{ transform: locale === "ar" ? "scaleX(-1)" : "none" }} />
          {t("auth.back_to_login")}
        </Link>

        <button
          onClick={toggleLanguage}
          disabled={isPending}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.3)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            background: "transparent",
            color: "rgba(255,255,255,0.8)",
            transition: "border-color 0.15s, color 0.15s",
            opacity: isPending ? 0.5 : 1,
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.borderColor = "#00C2A8";
            (e.target as HTMLButtonElement).style.color = "#00C2A8";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.3)";
            (e.target as HTMLButtonElement).style.color = "rgba(255,255,255,0.8)";
          }}
          aria-label={locale === "en" ? "Switch to Arabic" : "Switch to English"}
        >
          <Globe size={14} aria-hidden="true" />
          {locale === "en" ? "العربية" : "English"}
        </button>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#ffffff",
          borderRadius: 20,
          padding: "36px 32px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Link
            href="/"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <Image src="/assets/images/commuterLogo.png" alt="Commuter logo" width={46} height={46} />
            <span style={{ fontWeight: 900, fontSize: 22, color: "#0B1E3D" }}>Commuter</span>
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "#eef2f5",
            borderRadius: 12,
            padding: 4,
            marginBottom: 16,
          }}
          role="tablist"
          aria-label="Passenger or driver"
        >
          {(["passenger", "driver"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={role === r}
              onClick={() => setRole(r)}
              style={{
                padding: "10px 16px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 14,
                fontFamily: "inherit",
                background: role === r ? "#ffffff" : "transparent",
                color: role === r ? "#0B1E3D" : "#5A6A7A",
                boxShadow: role === r ? "0 1px 6px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.2s",
                minHeight: 44,
              }}
            >
              {r === "passenger" ? t("auth.passenger.role") : t("auth.driver.role")}
            </button>
          ))}
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0B1E3D", margin: "0 0 8px" }}>
          {t("auth.reset_password_title")}
        </h1>
        <p style={{ margin: "0 0 20px", color: "#5A6A7A", lineHeight: 1.6 }}>
          {t("auth.reset_password_desc", { role: roleLabel })}
        </p>

        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label htmlFor="phone" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0B1E3D", marginBottom: 6 }}>
              {t("auth.phone_number")}
            </label>
            <div
              dir="ltr"
              style={{
                ...fieldStyle,
                padding: 0,
                overflow: "hidden",
                flexDirection: "row",
                direction: "ltr",
                unicodeBidi: "isolate",
              }}
              onFocusCapture={(e) => focusField(e.currentTarget as HTMLDivElement)}
              onBlurCapture={(e) => blurField(e.currentTarget as HTMLDivElement)}
            >
              <span
                dir="ltr"
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  height: "100%",
                  padding: "0 12px",
                  background: "#eef1f3",
                  borderRight: "1.5px solid #e8edf0",
                  borderLeft: "none",
                  fontWeight: 600,
                  color: "#0B1E3D",
                  flexShrink: 0,
                  direction: "ltr",
                  unicodeBidi: "isolate",
                }}
              >
                <Phone size={17} style={{ color: "#5A6A7A" }} aria-hidden="true" />
                <span dir="ltr" style={{ direction: "ltr", unicodeBidi: "plaintext" }}>+20</span>
              </span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="1000000000"
                maxLength={10}
                required
                dir="ltr"
                value={phone.replace(/^\+?20/, "")}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setPhone(digits ? `+20${digits}` : "");
                }}
                style={{ ...inputStyle, padding: "0 14px", direction: "ltr", textAlign: "left" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              onClick={handleSendCode}
              disabled={sendingCode || loading}
              style={{ height: 46, borderRadius: 10, border: "1.5px solid #0B1E3D", background: "#fff", color: "#0B1E3D", fontWeight: 700, cursor: sendingCode || loading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {sendingCode ? <><Loader2 size={16} className="animate-spin" /> Sending code…</> : codeSent ? "Resend verification code" : "Send verification code"}
            </button>
            {codeSent ? (
              <div style={fieldStyle}>
                <Lock size={17} style={{ color: "#5A6A7A" }} aria-hidden="true" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit verification code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  style={{ ...inputStyle, letterSpacing: 3, direction: "ltr", textAlign: "left" }}
                />
              </div>
            ) : null}
          </div>

          <div>
            <label htmlFor="newPassword" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0B1E3D", marginBottom: 6 }}>
              {t("auth.new_password")}
            </label>
            <div style={fieldStyle} className="ltr-field">
              <Lock size={17} style={{ color: "#5A6A7A" }} aria-hidden="true" />
              <input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={t("auth.password_placeholder_register")}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ ...inputStyle, direction: "ltr", textAlign: "left" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5A6A7A" }}
                aria-label={showPassword ? t("auth.hide_password") : t("auth.show_password")}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <PasswordStrengthMeter password={newPassword} />
          </div>

          <div>
            <label htmlFor="confirmPassword" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0B1E3D", marginBottom: 6 }}>
              {t("auth.confirm_password")}
            </label>
            <div style={fieldStyle} className="ltr-field">
              <Lock size={17} style={{ color: "#5A6A7A" }} aria-hidden="true" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={t("auth.confirm_password_placeholder")}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ ...inputStyle, direction: "ltr", textAlign: "left" }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5A6A7A" }}
                aria-label={showConfirmPassword ? t("auth.hide_password") : t("auth.show_password")}
              >
                {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error ? (
            <div style={{ color: "#c0392b", fontSize: 13, fontWeight: 600 }}>{error}</div>
          ) : null}
          {success ? (
            <div style={{ color: "#0f9d58", fontSize: 13, fontWeight: 600 }}>{success}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              height: 50,
              borderRadius: 12,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "#5A6A7A" : "#0B1E3D",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 15,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 8px 20px rgba(11, 30, 61, 0.18)",
              fontFamily: "inherit",
              transition: "background 0.2s",
            }}
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> {t("auth.updating_password")}</> : t("auth.update_password_button")}
          </button>
        </form>
      </div>
    </div>
  );
}

