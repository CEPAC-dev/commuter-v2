"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import PasswordInput from "@/components/shared/PasswordInput";
import PasswordStrengthMeter from "@/components/shared/PasswordStrengthMeter";
import { isStrongPassword, PASSWORD_RULES_MESSAGE } from "@/lib/auth/validation";

export default function ChangePasswordSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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
      if (!res.ok) throw new Error(data.error ?? "Could not send a verification code.");
      setCodeSent(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send a verification code.");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (!isStrongPassword(newPassword)) return setError(PASSWORD_RULES_MESSAGE);
    if (newPassword !== confirmPassword) return setError("New passwords do not match.");
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit verification code.");

    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to change password.");
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
      setCodeSent(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ background: "#fff", borderRadius: 16, border: "1px solid #eef0f3", padding: 24 }}>
      <button type="button" onClick={() => setIsOpen((value) => !value)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0B1E3D", margin: 0 }}>Change password</h2>
        <span style={{ fontSize: 14, color: "#00C2A8", fontWeight: 700 }}>{isOpen ? "Hide" : "Change"}</span>
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 18 }}>
          <p style={{ margin: 0, color: "#5A6A7A", fontSize: 13, lineHeight: 1.5 }}>We’ll send a code to your account phone number before changing your password.</p>
          <PasswordInput label="New password" id="cp-new" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <PasswordStrengthMeter password={newPassword} />
          <PasswordInput label="Confirm new password" id="cp-confirm" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          {codeSent && <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit verification code" aria-label="6-digit verification code" required style={{ height: 48, borderRadius: 10, border: "1.5px solid #d0d8e0", padding: "0 14px", fontSize: 15, letterSpacing: 3, fontFamily: "inherit" }} />}
          {error && <p role="alert" style={{ fontSize: 13, color: "#e74c3c", margin: 0 }}>{error}</p>}
          {success && <p role="status" style={{ fontSize: 13, color: "#27AE60", margin: 0, display: "flex", alignItems: "center", gap: 8 }}><Check size={14} aria-hidden="true" />Password updated.</p>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={sendCode} disabled={sendingCode || saving} style={buttonStyle("secondary", sendingCode || saving)}>{sendingCode && <Loader2 size={16} className="animate-spin" />}{codeSent ? "Resend code" : "Send code"}</button>
            {codeSent && <button type="submit" disabled={saving || otp.length !== 6} style={buttonStyle("primary", saving || otp.length !== 6)}>{saving && <Loader2 size={16} className="animate-spin" />}Update password</button>}
          </div>
        </form>
      )}
    </section>
  );
}

function buttonStyle(variant: "primary" | "secondary", disabled: boolean): React.CSSProperties {
  return { height: 48, padding: "0 18px", background: variant === "primary" ? "#0B1E3D" : "#fff", color: variant === "primary" ? "#fff" : "#0B1E3D", fontWeight: 700, fontSize: 14, border: variant === "primary" ? "none" : "1.5px solid #d0d8e0", borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.65 : 1, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 };
}
