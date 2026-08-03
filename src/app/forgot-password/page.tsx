"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Lock, Phone, Eye, EyeOff } from "lucide-react";
import Image from "next/image";

type Role = "passenger" | "driver";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("passenger");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const payload = {
        phone: phone.trim(),
        role,
        newPassword,
        confirmPassword,
      };

      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }

      setSuccess("Password updated successfully. You can now log in.");
      setTimeout(() => router.replace("/login"), 1200);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
      }}
    >
      <div style={{ width: "100%", maxWidth: 440, marginBottom: 16 }}>
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
          }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to login
        </Link>
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
              {r === "passenger" ? "Passenger" : "Driver"}
            </button>
          ))}
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0B1E3D", margin: "0 0 8px" }}>
          Reset your password
        </h1>
        <p style={{ margin: "0 0 20px", color: "#5A6A7A", lineHeight: 1.6 }}>
          Enter your phone number and choose a new password for your {role} account.
        </p>

        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label htmlFor="phone" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0B1E3D", marginBottom: 6 }}>
              Phone number
            </label>
            <div
              style={{ ...fieldStyle, padding: 0, overflow: "hidden" }}
              onFocusCapture={(e) => focusField(e.currentTarget as HTMLDivElement)}
              onBlurCapture={(e) => blurField(e.currentTarget as HTMLDivElement)}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  height: "100%",
                  padding: "0 12px",
                  background: "#eef1f3",
                  borderRight: "1.5px solid #e8edf0",
                  fontWeight: 600,
                  color: "#0B1E3D",
                  flexShrink: 0,
                }}
              >
                <Phone size={17} style={{ color: "#5A6A7A" }} aria-hidden="true" />
                +20
              </span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="1000000000"
                maxLength={10}
                required
                value={phone.replace(/^\+?20/, "")}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setPhone(digits ? `+20${digits}` : "");
                }}
                style={{ ...inputStyle, padding: "0 14px" }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="newPassword" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0B1E3D", marginBottom: 6 }}>
              New password
            </label>
            <div style={fieldStyle}>
              <Lock size={17} style={{ color: "#5A6A7A" }} aria-hidden="true" />
              <input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ ...inputStyle }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5A6A7A" }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0B1E3D", marginBottom: 6 }}>
              Confirm password
            </label>
            <div style={fieldStyle}>
              <Lock size={17} style={{ color: "#5A6A7A" }} aria-hidden="true" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ ...inputStyle }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5A6A7A" }}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
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
              background: "#0B1E3D",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 15,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 8px 20px rgba(11, 30, 61, 0.18)",
            }}
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Updating...</> : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
