"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Lock, Phone, ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        setLoading(false);
        return;
      }
      router.replace("/admin/dashboard");
    } catch {
      setError("Network error. Please try again.");
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
      <div style={{ width: "100%", maxWidth: 440, background: "var(--color-panel)", borderRadius: 24, padding: "32px 28px", boxShadow: "0 24px 80px var(--color-shadow-strong)" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--color-muted)", textDecoration: "none", marginBottom: 20, fontSize: 14 }}>
          <ArrowLeft size={16} /> Back to home
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--color-secondary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={24} style={{ color: "var(--color-secondary)" }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-secondary)" }}>Admin sign in</p>
            <h1 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800, color: "var(--color-primary)" }}>Welcome back</h1>
          </div>
        </div>
        <p style={{ margin: "0 0 24px", color: "var(--color-muted)", lineHeight: 1.7 }}>Use your administrator phone number and password to access the admin dashboard.</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", display: "block", marginBottom: 6 }}>Phone</label>
            <div style={fieldStyle}>
              <Phone size={17} style={{ color: "var(--color-muted)" }} />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", color: "var(--color-primary)" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", display: "block", marginBottom: 6 }}>Password</label>
            <div style={fieldStyle}>
              <Lock size={17} style={{ color: "var(--color-muted)" }} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", color: "var(--color-primary)" }} />
            </div>
          </div>
          {error ? <p role="alert" style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: "var(--color-danger-tint)", color: "var(--color-danger)", border: "1px solid var(--color-danger)" }}>{error}</p> : null}
          <button type="submit" disabled={loading} style={{ height: 52, borderRadius: 12, background: loading ? "var(--color-disabled)" : "var(--color-primary)", color: "var(--color-on-primary)", fontWeight: 700, fontSize: 15, border: "none", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <><Loader2 size={18} className="spin" /> Signing in...</> : "Sign in"}
          </button>
        </form>
        <p style={{ marginTop: 18, textAlign: "center", color: "var(--color-muted)", fontSize: 14 }}>
          Need an admin account? <Link href="/admin/signup" style={{ color: "var(--color-secondary)", fontWeight: 700, textDecoration: "none" }}>Create one</Link>
        </p>
      </div>
    </div>
  );
}
