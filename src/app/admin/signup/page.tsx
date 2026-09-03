"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck, KeyRound, Phone, Lock, User, Mail, Globe } from "lucide-react";
import { useClientLocale, setLocaleCookie } from "@/lib/i18n/client";
import PasswordStrengthMeter from "@/components/shared/PasswordStrengthMeter";
import {
  isStrongPassword,
  normalizeEgyptPhone,
  toNationalDigits,
  PASSWORD_RULES_MESSAGE,
  PHONE_RULES_MESSAGE,
} from "@/lib/auth/validation";

export default function AdminSignupPage() {
  const router = useRouter();
  const { t, locale } = useClientLocale();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Language toggle
  function toggleLanguage() {
    const next = locale === "en" ? "ar" : "en";
    setLocaleCookie(next);
    startTransition(() => router.refresh());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const normalizedPhone = normalizeEgyptPhone(phone);
    if (!normalizedPhone) {
      setError(PHONE_RULES_MESSAGE);
      return;
    }
    if (!isStrongPassword(password)) {
      setError(PASSWORD_RULES_MESSAGE);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: normalizedPhone, password, inviteCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("auth.admin.unable_to_create"));
        setLoading(false);
        return;
      }
      router.replace("/admin/dashboard");
    } catch {
      setError(t("auth.network_error"));
      setLoading(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
    height: 52,
    background: "var(--color-background)",
    borderRadius: 12,
    border: "1.5px solid var(--color-border)",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--color-primary)", padding: "24px 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "var(--color-panel)", borderRadius: 24, padding: "32px 28px", boxShadow: "0 24px 80px var(--color-shadow-strong)", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--color-muted)", textDecoration: "none", fontSize: 14 }}>
            <ArrowLeft size={16} /> {t("auth.back_to_home")}
          </Link>
          
          {/* Language toggle button */}
          <button
            onClick={toggleLanguage}
            disabled={isPending}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: "var(--color-transparent)",
              color: "var(--color-primary)",
              transition: "border-color 0.15s, color 0.15s, background-color 0.15s",
              opacity: isPending ? 0.5 : 1,
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.borderColor = "var(--color-secondary)";
              (e.target as HTMLButtonElement).style.color = "var(--color-secondary)";
              (e.target as HTMLButtonElement).style.background = "var(--color-secondary-tint)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.borderColor = "var(--color-border)";
              (e.target as HTMLButtonElement).style.color = "var(--color-primary)";
              (e.target as HTMLButtonElement).style.background = "var(--color-transparent)";
            }}
            aria-label={locale === "en" ? "Switch to Arabic" : "Switch to English"}
          >
            <Globe size={14} aria-hidden="true" />
            {locale === "en" ? "العربية" : "English"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--color-secondary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={24} style={{ color: "var(--color-secondary)" }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-secondary)" }}>{t("auth.admin.access")}</p>
            <h1 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800, color: "var(--color-primary)" }}>{t("auth.admin.title")}</h1>
          </div>
        </div>
        <p style={{ margin: "0 0 24px", color: "var(--color-muted)", lineHeight: 1.7 }}>{t("auth.admin.description")}</p>
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", display: "block", marginBottom: 6 }}>{t("auth.admin.full_name")}</label>
            <div style={fieldStyle}>
              <User size={17} style={{ color: "var(--color-muted)" }} />
              <input value={name} onChange={(e) => setName(e.target.value)} required style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", color: "var(--color-primary)" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", display: "block", marginBottom: 6 }}>{t("auth.admin.email")}</label>
            <div style={fieldStyle}>
              <Mail size={17} style={{ color: "var(--color-muted)" }} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", color: "var(--color-primary)" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", display: "block", marginBottom: 6 }}>{t("auth.admin.phone")}</label>
            <div className="ltr-field" style={{ ...fieldStyle, padding: 0, overflow: "hidden" }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  height: "100%",
                  padding: "0 12px",
                  background: "var(--color-surface)",
                  borderRight: "1.5px solid var(--color-border)",
                  fontWeight: 600,
                  color: "var(--color-primary)",
                  flexShrink: 0,
                }}
              >
                <Phone size={17} style={{ color: "var(--color-muted)" }} aria-hidden="true" />
                <span>+20</span>
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="1XXXXXXXXX"
                maxLength={13}
                value={phone.replace(/^\+?20/, "")}
                onChange={(e) => {
                  const digits = toNationalDigits(e.target.value);
                  setPhone(digits ? `+20${digits}` : "");
                }}
                style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", color: "var(--color-primary)", padding: "0 14px", direction: "ltr", textAlign: "left" }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", display: "block", marginBottom: 6 }}>{t("auth.admin.password")}</label>
            <div style={fieldStyle}>
              <Lock size={17} style={{ color: "var(--color-muted)" }} />
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", color: "var(--color-primary)" }} />
            </div>
            <PasswordStrengthMeter password={password} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", display: "block", marginBottom: 6 }}>{t("auth.admin.invite_code")}</label>
            <div style={fieldStyle}>
              <KeyRound size={17} style={{ color: "var(--color-muted)" }} />
              <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", color: "var(--color-primary)" }} />
            </div>
          </div>
          {error ? <p role="alert" style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: "var(--color-danger-tint)", color: "var(--color-danger)", border: "1px solid var(--color-danger)" }}>{error}</p> : null}
          <button type="submit" disabled={loading} style={{ height: 52, borderRadius: 12, background: loading ? "var(--color-disabled)" : "var(--color-primary)", color: "var(--color-on-primary)", fontWeight: 700, fontSize: 15, border: "none", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <><Loader2 size={18} className="spin" /> {t("auth.admin.creating_account")}</> : t("auth.admin.create_account")}
          </button>
        </form>
      </div>
    </div>
  );
}
