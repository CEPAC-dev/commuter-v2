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
    background: "#f8f9fa",
    borderRadius: 12,
    border: "1.5px solid #e8edf0",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(140deg, #0B1E3D 0%, #1C3557 100%)", padding: "24px 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#ffffff", borderRadius: 24, padding: "32px 28px", boxShadow: "0 24px 80px rgba(0,0,0,0.3)" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#5A6A7A", textDecoration: "none", marginBottom: 20, fontSize: 14 }}>
          <ArrowLeft size={16} /> Back to home
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(0,194,168,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={24} style={{ color: "#00C2A8" }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#00C2A8" }}>Admin sign in</p>
            <h1 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800, color: "#0B1E3D" }}>Welcome back</h1>
          </div>
        </div>
        <p style={{ margin: "0 0 24px", color: "#5A6A7A", lineHeight: 1.7 }}>Use your administrator phone number and password to access the admin dashboard.</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D", display: "block", marginBottom: 6 }}>Phone</label>
            <div style={fieldStyle}>
              <Phone size={17} style={{ color: "#5A6A7A" }} />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", color: "#0B1E3D" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D", display: "block", marginBottom: 6 }}>Password</label>
            <div style={fieldStyle}>
              <Lock size={17} style={{ color: "#5A6A7A" }} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", color: "#0B1E3D" }} />
            </div>
          </div>
          {error ? <p role="alert" style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: "rgba(231,76,60,0.08)", color: "#e74c3c", border: "1px solid rgba(231,76,60,0.2)" }}>{error}</p> : null}
          <button type="submit" disabled={loading} style={{ height: 52, borderRadius: 12, background: loading ? "#5A6A7A" : "#0B1E3D", color: "#ffffff", fontWeight: 700, fontSize: 15, border: "none", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <><Loader2 size={18} className="spin" /> Signing in...</> : "Sign in"}
          </button>
        </form>
        <p style={{ marginTop: 18, textAlign: "center", color: "#5A6A7A", fontSize: 14 }}>
          Need an admin account? <Link href="/admin/signup" style={{ color: "#00C2A8", fontWeight: 700, textDecoration: "none" }}>Create one</Link>
        </p>
      </div>
    </div>
  );
}
