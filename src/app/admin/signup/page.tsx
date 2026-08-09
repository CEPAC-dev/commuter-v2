"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck, KeyRound, Phone, Lock, User, Mail, Globe } from "lucide-react";
import { useClientLocale, setLocaleCookie } from "@/lib/i18n/client";

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
    setLoading(true);

    try {
      const res = await fetch("/api/admin/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password, inviteCode }),
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
    background: "#f8f9fa",
    borderRadius: 12,
    border: "1.5px solid #e8edf0",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(140deg, #0B1E3D 0%, #1C3557 100%)", padding: "24px 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#ffffff", borderRadius: 24, padding: "32px 28px", boxShadow: "0 24px 80px rgba(0,0,0,0.3)", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#5A6A7A", textDecoration: "none", fontSize: 14 }}>
            <ArrowLeft size={16} /> {t("auth.back_to_home")}
          </Link>
          
          {/* Language toggle button */}
          <button
            onClick={toggleLanguage}
            disabled={isPending}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #e8edf0",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: "transparent",
              color: "#0B1E3D",
              transition: "border-color 0.15s, color 0.15s, background-color 0.15s",
              opacity: isPending ? 0.5 : 1,
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.borderColor = "#00C2A8";
              (e.target as HTMLButtonElement).style.color = "#00C2A8";
              (e.target as HTMLButtonElement).style.background = "rgba(0,194,168,0.05)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.borderColor = "#e8edf0";
              (e.target as HTMLButtonElement).style.color = "#0B1E3D";
              (e.target as HTMLButtonElement).style.background = "transparent";
            }}
            aria-label={locale === "en" ? "Switch to Arabic" : "Switch to English"}
          >
            <Globe size={14} aria-hidden="true" />
            {locale === "en" ? "العربية" : "English"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(0,194,168,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={24} style={{ color: "#00C2A8" }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#00C2A8" }}>{t("auth.admin.access")}</p>
            <h1 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800, color: "#0B1E3D" }}>{t("auth.admin.title")}</h1>
          </div>
        </div>
        <p style={{ margin: "0 0 24px", color: "#5A6A7A", lineHeight: 1.7 }}>{t("auth.admin.description")}</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D", display: "block", marginBottom: 6 }}>{t("auth.admin.full_name")}</label>
            <div style={fieldStyle}>
              <User size={17} style={{ color: "#5A6A7A" }} />
              <input value={name} onChange={(e) => setName(e.target.value)} required style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", color: "#0B1E3D" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D", display: "block", marginBottom: 6 }}>{t("auth.admin.email")}</label>
            <div style={fieldStyle}>
              <Mail size={17} style={{ color: "#5A6A7A" }} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", color: "#0B1E3D" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D", display: "block", marginBottom: 6 }}>{t("auth.admin.phone")}</label>
            <div style={fieldStyle}>
              <Phone size={17} style={{ color: "#5A6A7A" }} />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", color: "#0B1E3D" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D", display: "block", marginBottom: 6 }}>{t("auth.admin.password")}</label>
            <div style={fieldStyle}>
              <Lock size={17} style={{ color: "#5A6A7A" }} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", color: "#0B1E3D" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D", display: "block", marginBottom: 6 }}>{t("auth.admin.invite_code")}</label>
            <div style={fieldStyle}>
              <KeyRound size={17} style={{ color: "#5A6A7A" }} />
              <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", color: "#0B1E3D" }} />
            </div>
          </div>
          {error ? <p role="alert" style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: "rgba(231,76,60,0.08)", color: "#e74c3c", border: "1px solid rgba(231,76,60,0.2)" }}>{error}</p> : null}
          <button type="submit" disabled={loading} style={{ height: 52, borderRadius: 12, background: loading ? "#5A6A7A" : "#0B1E3D", color: "#ffffff", fontWeight: 700, fontSize: 15, border: "none", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <><Loader2 size={18} className="spin" /> {t("auth.admin.creating_account")}</> : t("auth.admin.create_account")}
          </button>
        </form>
      </div>
    </div>
  );
}
