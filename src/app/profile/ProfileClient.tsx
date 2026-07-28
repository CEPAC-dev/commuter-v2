"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Phone, Mail, Check, Loader2, Camera } from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import ChangePasswordSection from "@/components/shared/ChangePasswordSection";
import SavedAddressesSection from "@/components/shared/SavedAddressesSection";
import type { SavedAddress } from "@/types/shared";

interface Props {
  userNumber: number;
  initialName: string;
  email: string;
  initialPhone: string;
  initialProfilePic?: string | null;
  initialSavedAddresses: SavedAddress[];
}

export default function ProfileClient({
  userNumber,
  initialName,
  email,
  initialPhone,
  initialProfilePic,
  initialSavedAddresses,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [profilePic, setProfilePic] = useState(initialProfilePic ?? null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handlePicChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setError(uploadData.error ?? "Upload failed.");
        return;
      }
      const saveRes = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          profilePic: uploadData.path,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        setError(saveData.error ?? "Failed to save.");
        return;
      }
      setProfilePic(uploadData.path);
      router.refresh();
    } catch {
      setError("Network error. Please retry.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save.");
        return;
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
    } catch {
      setError("Network error. Please retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader authed email={email} variant="app" backHref="/" />

      <main
        style={{ maxWidth: 520, margin: "0 auto", padding: "32px 20px 48px" }}
      >
        {/* Avatar + name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={handlePicChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Change profile picture"
            className="group"
            style={{
              position: "relative",
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: "#00C2A8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
              border: "none",
              padding: 0,
              cursor: uploading ? "default" : "pointer",
            }}
          >
            {profilePic ? (
              <img
                src={profilePic}
                alt="Profile"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <User size={48} color="#fff" aria-hidden="true" />
            )}
            <div
              className="group-hover:opacity-100"
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(11,30,61,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: uploading ? 1 : 0,
                transition: "opacity 0.15s",
              }}
            >
              {uploading ? (
                <Loader2
                  size={22}
                  color="#fff"
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Camera size={22} color="#fff" aria-hidden="true" />
              )}
            </div>
          </button>
          <div>
            <p
              style={{
                margin: "0 0 2px",
                fontSize: 20,
                fontWeight: 800,
                color: "#0B1E3D",
                letterSpacing: "-0.02em",
              }}
            >
              {initialName}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "#5A6A7A" }}>
              #{userNumber} · {email}
            </p>
          </div>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSave}
          noValidate
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #eef0f3",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <h1
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#0B1E3D",
              margin: 0,
            }}
          >
            Edit profile
          </h1>

          {/* Name */}
          <div>
            <label
              htmlFor="p-name"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#0B1E3D",
                display: "block",
                marginBottom: 6,
              }}
            >
              Full name{" "}
              <span aria-hidden="true" style={{ color: "#e74c3c" }}>
                *
              </span>
            </label>
            <div style={{ position: "relative" }}>
              <User
                size={15}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9aa8b5",
                  pointerEvents: "none",
                }}
              />
              <input
                id="p-name"
                type="text"
                value={name}
                required
                autoComplete="name"
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  height: 48,
                  paddingLeft: 38,
                  paddingRight: 14,
                  border: "1.5px solid #d0d8e0",
                  borderRadius: 10,
                  fontSize: 15,
                  color: "#0B1E3D",
                  fontFamily: "inherit",
                  background: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#00C2A8")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#d0d8e0")}
              />
            </div>
          </div>

          {/* Email — read only */}
          <div>
            <label
              htmlFor="p-email"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#0B1E3D",
                display: "block",
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <div style={{ position: "relative" }}>
              <Mail
                size={15}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9aa8b5",
                  pointerEvents: "none",
                }}
              />
              <input
                id="p-email"
                type="email"
                value={email}
                readOnly
                aria-readonly="true"
                style={{
                  width: "100%",
                  height: 48,
                  paddingLeft: 38,
                  paddingRight: 14,
                  border: "1.5px solid #eef0f3",
                  borderRadius: 10,
                  fontSize: 15,
                  color: "#9aa8b5",
                  fontFamily: "inherit",
                  background: "#f8f9fa",
                  outline: "none",
                  boxSizing: "border-box",
                  cursor: "not-allowed",
                }}
              />
            </div>
            <p
              style={{ fontSize: 12, color: "#9aa8b5", margin: "5px 0 0 2px" }}
            >
              Email cannot be changed.
            </p>
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="p-phone"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#0B1E3D",
                display: "block",
                marginBottom: 6,
              }}
            >
              Phone number
            </label>
            <div
              style={{
                width: "100%",
                height: 48,
                padding: 0,
                display: "flex",
                alignItems: "stretch",
                overflow: "hidden",
                border: "1.5px solid #d0d8e0",
                borderRadius: 10,
                background: "#fff",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              className="phone-field"
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 12px",
                  fontWeight: 600,
                  color: "#0B1E3D",
                  background: "#eef1f3",
                  borderRight: "1.5px solid #d0d8e0",
                  flexShrink: 0,
                }}
              >
                <Phone size={15} color="#9aa8b5" aria-hidden="true" />
                +20
              </span>
              <input
                id="p-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                autoComplete="tel"
                placeholder="1XXXXXXXXX"
                value={phone.replace(/^\+?20/, "")}
                onChange={(e) => {
                  const digits = e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 10);
                  setPhone(digits ? `+20${digits}` : "");
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: "100%",
                  padding: "0 14px",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 15,
                  fontFamily: "inherit",
                  color: "#0B1E3D",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

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
              Profile updated.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              height: 52,
              background: saving ? "#9aa8b5" : "#0B1E3D",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              border: "none",
              borderRadius: 12,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "background 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
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
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </form>

        {/* Nav links */}
        <div
          style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}
        >
          {/* <Link
            href="/my-trips"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#0B1E3D",
              textDecoration: "none",
              padding: "10px 18px",
              background: "#fff",
              border: "1.5px solid #eef0f3",
              borderRadius: 10,
            }}
          >
            My requests →
          </Link> */}
          <Link
            href="/create"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#00C2A8",
              textDecoration: "none",
              padding: "10px 18px",
              background: "#eff7f6",
              border: "1.5px solid #c8e8e4",
              borderRadius: 10,
            }}
          >
            Book a ride →
          </Link>
        </div>

        <div style={{ marginTop: 20 }}>
          <ChangePasswordSection />
        </div>

        <SavedAddressesSection initialAddresses={initialSavedAddresses} />
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
