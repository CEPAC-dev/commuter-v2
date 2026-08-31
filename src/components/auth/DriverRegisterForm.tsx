"use client";
import { useState } from "react";
import { Loader2, TicketPercent } from "lucide-react";
import PasswordInput from "@/components/shared/PasswordInput";
import PasswordStrengthMeter from "@/components/shared/PasswordStrengthMeter";
import {
  isStrongPassword,
  normalizeEgyptPhone,
  toNationalDigits,
} from "@/lib/auth/validation";
import { useClientLocale } from "@/lib/i18n/client";

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#0B1E3D",
  display: "block",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 52,
  padding: "0 14px",
  background: "#f8f9fa",
  border: "1.5px solid #e8edf0",
  borderRadius: 12,
  fontSize: 15,
  fontFamily: "inherit",
  color: "#0B1E3D",
  outline: "none",
  boxSizing: "border-box",
  direction: "ltr",
  textAlign: "left",
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

interface Props {
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  gender: "male" | "female" | "";
  setGender: (v: "male" | "female" | "") => void;
  referralCode: string;
  onSuccess: () => void;
}

// Driver register = Personal Info only. Vehicle details + documents are
// completed later in /profile once the account exists.
export default function DriverRegisterForm({
  name,
  setName,
  phone,
  setPhone,
  password,
  setPassword,
  email,
  setEmail,
  gender,
  setGender,
  referralCode,
  onSuccess,
}: Props) {
  const { t } = useClientLocale();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate(): string {
    if (!name.trim() || !phone.trim() || !password)
      return t("auth.driver.name_required");
    if (!normalizeEgyptPhone(phone)) return t("auth.phone_invalid");
    if (!isStrongPassword(password)) return t("auth.password_weak");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return t("auth.driver.invalid_email");
    if (!gender) return t("auth.driver.gender_required");
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signUpDriver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: normalizeEgyptPhone(phone),
          password,
          email,
          gender,
          referralCodeUsed: referralCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("auth.driver.registration_failed"));
        setLoading(false);
        return;
      }
      onSuccess();
    } catch {
      setError(t("auth.network_error"));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label htmlFor="d-name" style={labelStyle}>
            {t("auth.driver.full_name")}{" "}
            <span aria-hidden="true" style={{ color: "#e74c3c" }}>
              *
            </span>
          </label>
          <input
            id="d-name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="d-phone" style={labelStyle}>
            {t("auth.driver.phone")}{" "}
            <span aria-hidden="true" style={{ color: "#e74c3c" }}>
              *
            </span>
          </label>
          <div
            dir="ltr"
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "stretch",
              height: 52,
              background: "#f8f9fa",
              border: "1.5px solid #e8edf0",
              borderRadius: 12,
              overflow: "hidden",
              direction: "ltr",
              unicodeBidi: "isolate",
            }}
          >
            <span
              dir="ltr"
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                padding: "0 12px",
                fontWeight: 600,
                color: "#0B1E3D",
                background: "#eef1f3",
                borderRight: "1.5px solid #e8edf0",
                direction: "ltr",
                unicodeBidi: "isolate",
              }}
            >
              <span dir="ltr" style={{ direction: "ltr", unicodeBidi: "plaintext" }}>+20</span>
            </span>
            <input
              id="d-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="1XXXXXXXXX"
              required
              maxLength={13}
              value={phone.replace(/^\+?20/, "")}
              onChange={(e) => {
                const digits = toNationalDigits(e.target.value);
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
                direction: "ltr",
                textAlign: "left",
              }}
            />
          </div>
        </div>
        <PasswordInput
          label={t("auth.driver.password") + " *"}
          id="d-password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrengthMeter password={password} />
        <p style={{ fontSize: 12, color: "#5A6A7A", margin: 0 }}>
          {t("auth.password_rules")}
        </p>
        <div>
          <label htmlFor="d-gender" style={labelStyle}>
            {t("auth.driver.gender")}{" "}
            <span aria-hidden="true" style={{ color: "#e74c3c" }}>
              *
            </span>
          </label>
          <select
            id="d-gender"
            required
            value={gender}
            onChange={(e) => setGender(e.target.value as "male" | "female")}
            style={selectStyle}
          >
            <option value="">{t("auth.driver.gender_select")}</option>
            <option value="male">{t("auth.driver.gender_male")}</option>
            <option value="female">{t("auth.driver.gender_female")}</option>
          </select>
        </div>
        <div>
          <label htmlFor="d-email" style={labelStyle}>
            {t("auth.driver.email")}{" "}
            <span style={{ fontWeight: 400, color: "#5A6A7A" }}>
              {t("auth.email_optional")}
            </span>
          </label>
          <input
            id="d-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </div>
        {referralCode ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label htmlFor="d-referral-code" style={{ ...labelStyle, marginBottom: 0 }}>
                {t("auth.referral_code")}
              </label>
              <span style={{ background: "rgba(0,194,168,0.12)", color: "#00877A", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                Applied from link
              </span>
            </div>
            <div style={{ position: "relative" }}>
              <TicketPercent size={17} aria-hidden="true" style={{ position: "absolute", left: 14, top: 18, color: "#00877A" }} />
              <input
                id="d-referral-code"
                type="text"
                readOnly
                value={referralCode}
                style={{ ...inputStyle, paddingLeft: 42, background: "#f1fcf9", borderColor: "#00C2A8", color: "#00877A", fontWeight: 700 }}
              />
            </div>
          </div>
        ) : null}
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
            marginTop: 16,
            marginBottom: 0,
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: 20,
          width: "100%",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: loading ? "#5A6A7A" : "#0B1E3D",
          color: "#ffffff",
          fontWeight: 700,
          fontSize: 15,
          border: "none",
          borderRadius: 12,
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {loading && <Loader2 size={18} className="spin" aria-hidden="true" />}
        {loading ? t("auth.driver.creating_account") : t("auth.driver.create_account")}
      </button>
    </form>
  );
}
