"use client";
import { useState } from "react";
import Link from "next/link";
import {
  User,
  Loader2,
  Check,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import Section from "@/components/shared/Section";
import ChangePasswordSection from "@/components/shared/ChangePasswordSection";
import PhoneVerificationCard from "@/components/shared/PhoneVerificationCard";
import ReferralCard from "@/components/shared/ReferralCard";
import SavedAddressesSection from "@/components/shared/SavedAddressesSection";
import type { CarType } from "@/lib/config/driver";
import type { SavedAddress } from "@/types/shared";
import { useClientLocale } from "@/lib/locale.client";

interface Props {
  userNumber: number;
  initialName: string;
  email: string;
  initialPhone: string;
  initialPhoneVerified: boolean;
  gender: "male" | "female";
  carType: CarType | "";
  carBrand?: string;
  carModel?: string;
  modelYear?: number | null;
  vehicleColor?: string;
  plateChar1?: string;
  plateChar2?: string;
  plateChar3?: string;
  plateDigits?: string;
  licenseExpiry?: string;
  carCapacity?: number;
  documents: Record<string, string | null>;
  verificationStatus: "incomplete" | "pending" | "verified";
  profileSince: string;
  initialSavedAddresses: SavedAddress[];
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#0B1E3D",
  display: "block",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: 48,
  padding: "0 14px",
  background: "#f8f9fa",
  border: "1.5px solid #e8edf0",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  color: "#0B1E3D",
  outline: "none",
  boxSizing: "border-box",
};

function getSelectStyle(dir: "ltr" | "rtl"): React.CSSProperties {
  const isRtl = dir === "rtl";
  // single-path SVG caret (down arrow) encoded to avoid gradient artifacts near rounded corners
  const encodedSvg = "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M1 3l4 4 4-4' stroke='%235A6A7A' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

  return {
    ...inputStyle,
    cursor: "pointer",
    paddingInlineEnd: isRtl ? 14 : 36,
    paddingInlineStart: isRtl ? 36 : 14,
    textAlign: isRtl ? "right" : "left",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    backgroundImage: `url("data:image/svg+xml;utf8,${encodedSvg}")`,
    backgroundPosition: isRtl ? "12px center" : "calc(100% - 18px) center",
    backgroundSize: "12px",
    backgroundRepeat: "no-repeat",
  };
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

function saveButtonStyle(loading: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    padding: "0 20px",
    background: loading ? "#5A6A7A" : "#0B1E3D",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 14,
    border: "none",
    borderRadius: 10,
    cursor: loading ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    alignSelf: "flex-start",
  };
}

export default function DriverProfileClient({
  userNumber,
  initialName,
  email,
  initialPhone,
  initialPhoneVerified,
  gender: initialGender,
  documents,
  verificationStatus,
  initialSavedAddresses,
}: Props) {
  const { dir, t } = useClientLocale();
  const selectStyle = getSelectStyle(dir);
  // Personal info
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [gender, setGender] = useState(initialGender);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalMsg, setPersonalMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  async function savePersonal(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setPersonalMsg({ ok: false, text: t("error.name_required") });
      return;
    }
    setSavingPersonal(true);
    setPersonalMsg(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          gender,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPersonalMsg({ ok: false, text: data.error ?? t("error.save_failed") });
        return;
      }
      setPersonalMsg({ ok: true, text: t("action.saved") });
    } catch {
      setPersonalMsg({ ok: false, text: t("error.network") });
    } finally {
      setSavingPersonal(false);
    }
  }

  const statusConfig: Record<
    typeof verificationStatus,
    { label: string; bg: string; color: string }
  > = {
    incomplete: { label: t("profile.status.incomplete"), bg: "#FFF3E0", color: "#E65100" },
    pending: { label: t("profile.status.pending"), bg: "#FFF8E1", color: "#F57F17" },
    verified: { label: t("profile.status.verified"), bg: "#E8F5E9", color: "#27AE60" },
  };
  const statusCfg = statusConfig[verificationStatus];

  const verificationCta =
    verificationStatus === "verified"
      ? t("verification.cta_view")
      : verificationStatus === "pending"
        ? t("verification.cta_view_submission")
        : t("verification.cta_complete");

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader
        authed
        email={email}
        role="driver"
        variant="app"
        backHref="/my-trips"
      />

      <style>{`
        .profile-shell { max-width: 560px; margin: 0 auto; padding: 32px 20px 48px; }
        .profile-columns { display: grid; grid-template-columns: 1fr; gap: 20px; align-items: start; }
        /* Grid items default to min-width:auto, which lets form controls' UA min-content size
           force the track (and page) wider than the viewport. Force them shrinkable. */
        .profile-columns > * { min-width: 0; }
        @media (min-width: 900px) {
          .profile-shell { max-width: 960px; padding: 44px 32px 72px; }
          .profile-columns { grid-template-columns: minmax(0, 1fr) 360px; gap: 32px; }
        }
      `}</style>

      <main dir={dir} className="profile-shell">
        {/* Avatar + name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 104,
              height: 104,
              borderRadius: "50%",
              background: "#00C2A8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
              border: "3px solid #ffffff",
              boxShadow: "0 0 0 1px #e8edf0, 0 8px 20px rgba(11,30,61,0.1)",
            }}
          >
            {documents.profilePic ? (
              <img
                src={documents.profilePic}
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
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 2,
                flexWrap: "wrap",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#0B1E3D",
                  letterSpacing: "-0.02em",
                }}
              >
                {initialName}
              </p>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: statusCfg.bg,
                  color: statusCfg.color,
                  whiteSpace: "nowrap",
                }}
              >
                {statusCfg.label}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#5A6A7A", overflowWrap: "anywhere" }}>
              #{userNumber}
              {email ? ` · ${email}` : ""}
            </p>
          </div>
        </div>

        <div className="profile-columns">
          <div>

        {/* Personal information */}
        <Section title={t("profile.personal_info")}>
          <form onSubmit={savePersonal} noValidate style={cardStyle}>
            <div>
              <label htmlFor="p-name" style={labelStyle}>
                {t("profile.name")}{" "}
                <span aria-hidden="true" style={{ color: "#e74c3c" }}>
                  *
                </span>
              </label>
              <input
                id="p-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="p-phone" style={labelStyle}>
                {t("profile.phone")}
              </label>
              <div
                dir="ltr"
                style={{
                  ...inputStyle,
                  padding: 0,
                  display: "flex",
                  alignItems: "stretch",
                  overflow: "hidden",
                  direction: "ltr",
                }}
              >
                <span
                  dir="ltr"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0 12px",
                    fontWeight: 600,
                    color: "#0B1E3D",
                    background: "#eef1f3",
                    borderRight: dir === "ltr" ? "1.5px solid #e8edf0" : undefined,
                    borderLeft: dir === "rtl" ? "1.5px solid #e8edf0" : undefined,
                    direction: "ltr",
                  }}
                >
                  +20
                </span>
                <input
                  id="p-phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
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
                    fontSize: 14,
                    fontFamily: "inherit",
                    color: "#0B1E3D",
                    boxSizing: "border-box",
                    textAlign: "left",
                    direction: "ltr",
                  }}
                />
              </div>
            </div>
            <div>
              <label htmlFor="p-gender" style={labelStyle}>
                {t("profile.gender")}
              </label>
              <select
                id="p-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as "male" | "female")}
                style={selectStyle}
              >
                <option value="male">{t("gender.male")}</option>
                <option value="female">{t("gender.female")}</option>
              </select>
            </div>
            {personalMsg && (
              <p
                role="status"
                aria-live="polite"
                style={{
                  fontSize: 13,
                  margin: 0,
                  color: personalMsg.ok ? "#27AE60" : "#e74c3c",
                }}
              >
                {personalMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={savingPersonal}
              style={saveButtonStyle(savingPersonal)}
            >
              {savingPersonal ? (
                <Loader2 size={16} className="spin" aria-hidden="true" />
              ) : (
                <Check size={16} aria-hidden="true" />
              )}
              {savingPersonal ? t("action.saving") : t("profile.save")}
            </button>
          </form>
        </Section>

        {/* Vehicle & documents verification */}
        <Section title={t("verification.section_title")}>
          <div style={{ ...cardStyle, gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,194,168,0.12)",
                    color: "#00877A",
                  }}
                >
                  <ShieldCheck size={19} aria-hidden="true" />
                </span>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0B1E3D" }}>
                    {t("profile.driver_details")} &amp; {t("profile.documents").toLowerCase()}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#5A6A7A" }}>
                    {t("verification.section_hint")}
                  </p>
                </div>
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: statusCfg.bg,
                  color: statusCfg.color,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {statusCfg.label}
              </span>
            </div>

            <Link
              href="/profile/verification"
              style={{
                ...saveButtonStyle(false),
                textDecoration: "none",
                alignSelf: "stretch",
                justifyContent: "center",
              }}
            >
              {verificationCta}
              {dir === "rtl" ? <ArrowLeft size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
            </Link>
          </div>
        </Section>
          </div>

          <div>
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#00877A",
              }}
            >
              {t("profile.account_section")}
            </p>
            <ChangePasswordSection />
            <div style={{ marginTop: 20 }}>
              <PhoneVerificationCard initialVerified={initialPhoneVerified} />
            </div>
            <div style={{ marginTop: 20 }}>
              <ReferralCard />
            </div>
            <div style={{ marginTop: 20 }}>
              <SavedAddressesSection initialAddresses={initialSavedAddresses} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
