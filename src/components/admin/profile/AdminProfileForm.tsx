"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Save, Send } from "lucide-react";
import { AdminButton, AdminCard, AdminFormField } from "@/components/admin/layout";
import SecurityQuestionSetupCard from "@/components/shared/SecurityQuestionSetupCard";
import type { VerificationMethod } from "@/lib/config/verification";

interface AdminProfile {
  name: string;
  email: string;
  phone: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 42,
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-background)",
  color: "var(--color-primary)",
  font: "inherit",
};

export default function AdminProfileForm({
  initialProfile,
  verificationMethod,
  securityQuestion,
  hasSecurityQuestion,
}: {
  initialProfile: AdminProfile;
  verificationMethod: VerificationMethod;
  securityQuestion: string | null;
  hasSecurityQuestion: boolean;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [contactPassword, setContactPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");
    try {
      const response = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, currentPassword: contactPassword }),
      });
      const result = await response.json();
      if (!response.ok) {
        setProfileMessage(result.error ?? "Failed to update profile.");
        return;
      }
      setProfile({
        name: result.data.name ?? "",
        email: result.data.email ?? "",
        phone: result.data.phone ?? "",
      });
      setContactPassword("");
      setProfileMessage("Profile updated.");
      router.refresh();
    } catch {
      setProfileMessage("Could not reach the server. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordMessage("");
    try {
      const response = await fetch("/api/admin/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword,
          confirmPassword,
          ...(verificationMethod === "sms_otp" ? { otp } : { securityAnswer }),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setPasswordMessage(result.error ?? "Failed to change password.");
        return;
      }
      setOtp("");
      setSecurityAnswer("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password changed.");
    } catch {
      setPasswordMessage("Could not reach the server. Please try again.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function requestOtp() {
    setSendingOtp(true);
    setPasswordMessage("");
    try {
      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "password_change" }),
      });
      const result = await response.json();
      if (!response.ok) {
        setPasswordMessage(result.error ?? "Could not send a verification code.");
        return;
      }
      setPasswordMessage("Verification code sent to your account phone.");
    } catch {
      setPasswordMessage("Could not reach the server. Please try again.");
    } finally {
      setSendingOtp(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <AdminCard title="Account information" description="Manage the details used for your admin account.">
        <form onSubmit={saveProfile} style={{ display: "grid", gap: 16 }}>
          <AdminFormField label="Full name">
            <input
              autoComplete="name"
              required
              maxLength={100}
              style={inputStyle}
              value={profile.name}
              onChange={(event) =>
                setProfile((current) => ({ ...current, name: event.target.value }))
              }
            />
          </AdminFormField>
          <AdminFormField label="Email address">
            <input
              autoComplete="email"
              type="email"
              maxLength={254}
              style={inputStyle}
              value={profile.email}
              onChange={(event) =>
                setProfile((current) => ({ ...current, email: event.target.value }))
              }
            />
          </AdminFormField>
          <AdminFormField label="Phone number" hint="Use a valid Egyptian mobile number.">
            <input
              autoComplete="tel"
              type="tel"
              required
              maxLength={20}
              style={inputStyle}
              value={profile.phone}
              onChange={(event) =>
                setProfile((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </AdminFormField>
          <AdminFormField
            label="Current password"
            hint="Required only when changing your email address or phone number."
          >
            <input
              autoComplete="current-password"
              type="password"
              style={inputStyle}
              value={contactPassword}
              onChange={(event) => setContactPassword(event.target.value)}
            />
          </AdminFormField>
          {profileMessage ? (
            <p role="status" style={{ margin: 0, color: "var(--color-muted)", fontSize: 13 }}>
              {profileMessage}
            </p>
          ) : null}
          <div>
            <AdminButton type="submit" disabled={savingProfile}>
              <Save size={16} aria-hidden="true" />
              {savingProfile ? "Saving..." : "Save profile"}
            </AdminButton>
          </div>
        </form>
      </AdminCard>

      <AdminCard
        title="Change password"
        description={
          verificationMethod === "sms_otp"
            ? "Verify your identity with the SMS code sent to your account phone."
            : "Verify your identity by answering your security question."
        }
      >
        {verificationMethod === "security_question" && !hasSecurityQuestion ? (
          <div style={{ marginBottom: 16 }}>
            <SecurityQuestionSetupCard initialHasSecurityQuestion={false} />
          </div>
        ) : null}
        <form onSubmit={changePassword} style={{ display: "grid", gap: 16 }}>
          {verificationMethod === "sms_otp" ? (
            <>
              <AdminFormField label="SMS verification code">
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  type="text"
                  required
                  maxLength={6}
                  style={inputStyle}
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </AdminFormField>
              <div>
                <AdminButton
                  type="button"
                  variant="secondary"
                  disabled={sendingOtp}
                  onClick={() => void requestOtp()}
                >
                  <Send size={16} aria-hidden="true" />
                  {sendingOtp ? "Sending..." : "Send verification code"}
                </AdminButton>
              </div>
            </>
          ) : hasSecurityQuestion ? (
            <>
              <AdminFormField label="Security question">
                <input readOnly style={inputStyle} value={securityQuestion ?? ""} />
              </AdminFormField>
              <AdminFormField label="Your answer">
                <input
                  autoComplete="off"
                  type="password"
                  required
                  maxLength={120}
                  style={inputStyle}
                  value={securityAnswer}
                  onChange={(event) => setSecurityAnswer(event.target.value)}
                />
              </AdminFormField>
            </>
          ) : (
            <p role="status" style={{ margin: 0, color: "var(--color-muted)", fontSize: 13 }}>
              Set up a security question before changing your password.
            </p>
          )}
          <AdminFormField label="New password" hint="At least 8 characters, with uppercase, lowercase, number and symbol.">
            <input
              autoComplete="new-password"
              type="password"
              required
              minLength={8}
              style={inputStyle}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </AdminFormField>
          <AdminFormField label="Confirm new password">
            <input
              autoComplete="new-password"
              type="password"
              required
              minLength={8}
              style={inputStyle}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </AdminFormField>
          {passwordMessage ? (
            <p role="status" style={{ margin: 0, color: "var(--color-muted)", fontSize: 13 }}>
              {passwordMessage}
            </p>
          ) : null}
          <div>
            <AdminButton
              type="submit"
              disabled={
                savingPassword ||
                (verificationMethod === "security_question" && !hasSecurityQuestion)
              }
            >
              <KeyRound size={16} aria-hidden="true" />
              {savingPassword ? "Updating..." : "Change password"}
            </AdminButton>
          </div>
        </form>
      </AdminCard>
    </div>
  );
}
