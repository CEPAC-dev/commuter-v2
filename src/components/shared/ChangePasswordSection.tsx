"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import PasswordInput from "@/components/shared/PasswordInput";
import PasswordStrengthMeter from "@/components/shared/PasswordStrengthMeter";

export default function ChangePasswordSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All password fields are required.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to change password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Network error. Please retry.");
    } finally {
      setSaving(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #eef0f3",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };

  return (
    <div style={cardStyle}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
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
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#0B1E3D",
            margin: 0,
          }}
        >
          Change password
        </h2>
        <span style={{ fontSize: 14, color: "#00C2A8", fontWeight: 700 }}>
          {isOpen ? "Hide" : "Show"}
        </span>
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <PasswordInput
            label="Current password"
            id="cp-current"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

      <PasswordInput
        label="New password"
        id="cp-new"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <PasswordStrengthMeter password={newPassword} />

          <PasswordInput
            label="Confirm new password"
            id="cp-confirm"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {error && (
            <p
              role="alert"
              aria-live="assertive"
              style={{
                fontSize: 13,
                color: "#e74c3c",
                background: "rgba(231,76,60,0.07)",
                border: "1px solid rgba(231,76,60,0.2)",
                borderRadius: 8,
                padding: "10px 14px",
                margin: 0,
              }}
            >
              {error}
            </p>
          )}

          {success && (
            <p
              role="status"
              aria-live="polite"
              style={{
                fontSize: 13,
                color: "#27AE60",
                background: "rgba(39,174,96,0.07)",
                border: "1px solid rgba(39,174,96,0.25)",
                borderRadius: 8,
                padding: "10px 14px",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Check size={14} aria-hidden="true" />
              Password updated.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              height: 48,
              padding: "0 20px",
              background: saving ? "#9aa8b5" : "#0B1E3D",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              border: "none",
              borderRadius: 10,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "background 0.2s",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              alignSelf: "flex-start",
            }}
            onMouseEnter={(e) => {
              if (!saving) e.currentTarget.style.background = "#00C2A8";
            }}
            onMouseLeave={(e) => {
              if (!saving) e.currentTarget.style.background = "#0B1E3D";
            }}
          >
            {saving ? (
              <>
                <Loader2
                  size={16}
                  aria-hidden="true"
                  style={{ animation: "spin 0.7s linear infinite" }}
                />
                Updating…
              </>
            ) : (
              "Update password"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
