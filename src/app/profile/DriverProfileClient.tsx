"use client";
import { useState, useRef } from "react";
import {
  User,
  Loader2,
  Check,
  Upload,
  FileText,
  Car,
  Calendar,
} from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import Section from "@/components/shared/Section";
import ChangePasswordSection from "@/components/shared/ChangePasswordSection";
import SavedAddressesSection from "@/components/shared/SavedAddressesSection";
import { CAR_TYPE_LIST, type CarType } from "@/lib/config/driver";
import type { SavedAddress } from "@/types/shared";

interface DocKey {
  key:
    | "nationalIdFront"
    | "nationalIdBack"
    | "drivingLicense"
    | "carLicenseFront"
    | "carLicenseBack"
    | "criminalRecord"
    | "profilePic"
    | "carImage";
  label: string;
}

const DOCUMENTS: DocKey[] = [
  { key: "nationalIdFront", label: "National ID (Front)" },
  { key: "nationalIdBack", label: "National ID (Back)" },
  { key: "drivingLicense", label: "Driving license" },
  { key: "carLicenseFront", label: "Car license (Front)" },
  { key: "carLicenseBack", label: "Car license (Back)" },
  { key: "criminalRecord", label: "Criminal record certificate" },
  { key: "profilePic", label: "Profile picture" },
  { key: "carImage", label: "Car image" },
];

interface Props {
  userNumber: number;
  initialName: string;
  email: string;
  initialPhone: string;
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

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

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

function ProgressBar({
  pct,
  filled,
  total,
}: {
  pct: number;
  filled: number;
  total: number;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 12, color: "#5A6A7A", fontWeight: 500 }}>
          {filled} / {total} complete
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: pct === 100 ? "#27AE60" : "#0B1E3D",
          }}
        >
          {pct}%
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: "#eef0f3",
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: pct === 100 ? "#27AE60" : "#00C2A8",
            borderRadius: 99,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

export default function DriverProfileClient({
  userNumber,
  initialName,
  email,
  initialPhone,
  gender: initialGender,
  carType: initialCarType,
  carBrand: initialCarBrand = "",
  carModel: initialCarModel = "",
  modelYear: initialModelYear = null,
  vehicleColor: initialVehicleColor = "",
  plateChar1: initialPlateChar1 = "",
  plateChar2: initialPlateChar2 = "",
  plateChar3: initialPlateChar3 = "",
  plateDigits: initialPlateDigits = "",
  licenseExpiry: initialLicenseExpiry = "",
  carCapacity,
  documents: initialDocuments,
  verificationStatus: initialVerificationStatus,
  profileSince,
  initialSavedAddresses,
}: Props) {
  // Personal info
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [gender, setGender] = useState(initialGender);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalMsg, setPersonalMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // Driver details
  const [carType, setCarType] = useState<CarType | "">(initialCarType);
  const [carBrand, setCarBrand] = useState(initialCarBrand);
  const [carModel, setCarModel] = useState(initialCarModel);
  const [modelYear, setModelYear] = useState(
    initialModelYear ? String(initialModelYear) : "",
  );
  const [vehicleColor, setVehicleColor] = useState(initialVehicleColor);
  const [plateChar1, setPlateChar1] = useState(initialPlateChar1);
  const [plateChar2, setPlateChar2] = useState(initialPlateChar2);
  const [plateChar3, setPlateChar3] = useState(initialPlateChar3);
  const [plateDigits, setPlateDigits] = useState(initialPlateDigits);
  const [licenseExpiry, setLicenseExpiry] = useState(initialLicenseExpiry);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const capacity = carType
    ? CAR_TYPE_LIST.find((c) => c.key === carType)?.capacity
    : carCapacity;

  // Documents
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  // License plate refs for auto-focus
  const plateChar1Ref = useRef<HTMLInputElement>(null);
  const plateChar2Ref = useRef<HTMLInputElement>(null);
  const plateChar3Ref = useRef<HTMLInputElement>(null);
  const plateDigitsRef = useRef<HTMLInputElement>(null);

  // Verification
  const [verificationStatus, setVerificationStatus] = useState(
    initialVerificationStatus,
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // Progress helpers (after all useState)
  const DETAIL_FIELDS = [
    carType,
    carBrand.trim(),
    carModel.trim(),
    (() => {
      const y = Number(modelYear);
      return modelYear.trim() && Number.isInteger(y) && y >= 1900 && y <= 2100
        ? modelYear
        : "";
    })(),
    vehicleColor.trim(),
    /^[\u0600-\u06FF]$/.test(plateChar1) ? plateChar1 : "",
    /^[\u0600-\u06FF]$/.test(plateChar2) ? plateChar2 : "",
    /^[\u0600-\u06FF]$/.test(plateChar3) ? plateChar3 : "",
    /^\d{3,4}$/.test(plateDigits) ? plateDigits : "",
    licenseExpiry.trim(),
  ];
  const detailsFilledCount = DETAIL_FIELDS.filter(Boolean).length;
  const detailsPct = Math.round(
    (detailsFilledCount / DETAIL_FIELDS.length) * 100,
  );

  const docsFilledCount = DOCUMENTS.filter((d) =>
    Boolean(documents[d.key]),
  ).length;
  const docsPct = Math.round((docsFilledCount / DOCUMENTS.length) * 100);

  const canSubmit = detailsPct === 100 && docsPct === 100;

  async function savePersonal(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setPersonalMsg({ ok: false, text: "Name is required." });
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
        setPersonalMsg({ ok: false, text: data.error ?? "Failed to save." });
        return;
      }
      setPersonalMsg({ ok: true, text: "Saved." });
    } catch {
      setPersonalMsg({ ok: false, text: "Network error. Please retry." });
    } finally {
      setSavingPersonal(false);
    }
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    const yearNum = Number(modelYear);
    if (
      !carType ||
      !carBrand.trim() ||
      !carModel.trim() ||
      !modelYear.trim() ||
      !Number.isInteger(yearNum) ||
      yearNum < 1900 ||
      yearNum > 2100 ||
      !vehicleColor.trim() ||
      !/^[\u0600-\u06FF]$/.test(plateChar1) ||
      !/^[\u0600-\u06FF]$/.test(plateChar2) ||
      !/^[\u0600-\u06FF]$/.test(plateChar3) ||
      !/^\d{3,4}$/.test(plateDigits) ||
      !licenseExpiry.trim()
    ) {
      setDetailsMsg({ ok: false, text: "All vehicle details are required." });
      return;
    }
    setSavingDetails(true);
    setDetailsMsg(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          carType,
          carBrand: carBrand.trim(),
          carModel: carModel.trim(),
          modelYear: yearNum,
          vehicleColor: vehicleColor.trim(),
          plateChar1,
          plateChar2,
          plateChar3,
          plateDigits,
          licenseExpiry: licenseExpiry.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDetailsMsg({ ok: false, text: data.error ?? "Failed to save." });
        return;
      }
      setDetailsMsg({ ok: true, text: "Saved." });
    } catch {
      setDetailsMsg({ ok: false, text: "Network error. Please retry." });
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleFileChange(key: string, file: File | null) {
    if (!file) return;
    setUploading((u) => ({ ...u, [key]: true }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        console.error(uploadData.error ?? "Upload failed.");
        return;
      }

      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          documents: { [key]: uploadData.path },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDocuments((d) => ({ ...d, [key]: uploadData.path }));
      } else {
        console.error(data.error ?? "Failed to save document.");
      }
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
      if (fileInputs.current[key]) fileInputs.current[key]!.value = "";
    }
  }

  const profileSinceLabel = new Date(profileSince).toLocaleDateString("en-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function submitForReview() {
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const res = await fetch("/api/driver/submit-review", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        const missingText = Array.isArray(data.missing)
          ? `Missing: ${data.missing.join(", ")}.`
          : (data.error ?? "Could not submit for review.");
        setSubmitMsg({ ok: false, text: missingText });
        return;
      }
      setVerificationStatus("pending");
      setSubmitMsg({ ok: true, text: "Submitted for review." });
    } catch {
      setSubmitMsg({ ok: false, text: "Network error. Please retry." });
    } finally {
      setSubmitting(false);
    }
  }

  const statusConfig: Record<
    typeof verificationStatus,
    { label: string; bg: string; color: string }
  > = {
    incomplete: { label: "Not verified", bg: "#FFF3E0", color: "#E65100" },
    pending: { label: "Under review", bg: "#FFF8E1", color: "#F57F17" },
    verified: { label: "Verified", bg: "#E8F5E9", color: "#27AE60" },
  };
  const statusCfg = statusConfig[verificationStatus];

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader
        authed
        email={email}
        role="driver"
        variant="app"
        backHref="/my-trips"
      />

      <main
        style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px 48px" }}
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
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: "#00C2A8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
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
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 2,
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
            <p style={{ margin: 0, fontSize: 13, color: "#5A6A7A" }}>
              #{userNumber} · {email}
            </p>
          </div>
        </div>

        {/* Personal information */}
        <Section title="Personal information">
          <form onSubmit={savePersonal} noValidate style={cardStyle}>
            <div>
              <label htmlFor="p-name" style={labelStyle}>
                Full name{" "}
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
                Phone
              </label>
              <div
                style={{
                  ...inputStyle,
                  padding: 0,
                  display: "flex",
                  alignItems: "stretch",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0 12px",
                    fontWeight: 600,
                    color: "#0B1E3D",
                    background: "#eef1f3",
                    borderRight: "1.5px solid #e8edf0",
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
                  }}
                />
              </div>
            </div>
            <div>
              <label htmlFor="p-gender" style={labelStyle}>
                Gender
              </label>
              <select
                id="p-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as "male" | "female")}
                style={selectStyle}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
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
              {savingPersonal ? "Saving…" : "Save"}
            </button>
          </form>
        </Section>

        {/* Driver details */}
        <Section title="Driver details">
          <ProgressBar
            pct={detailsPct}
            filled={detailsFilledCount}
            total={DETAIL_FIELDS.length}
          />
          <form onSubmit={saveDetails} noValidate style={cardStyle}>
            <div>
              <label htmlFor="d-carType" style={labelStyle}>
                Car type
              </label>
              <select
                id="d-carType"
                value={carType}
                onChange={(e) => setCarType(e.target.value as CarType)}
                style={selectStyle}
              >
                <option value="">Select…</option>
                {CAR_TYPE_LIST.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p
                style={{
                  fontSize: 12,
                  color: "#5A6A7A",
                  marginTop: 5,
                  marginBottom: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Car size={13} aria-hidden="true" /> Capacity: {capacity ?? "—"}{" "}
                passengers (auto-calculated)
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <label htmlFor="d-carBrand" style={labelStyle}>
                  Brand
                </label>
                <input
                  id="d-carBrand"
                  type="text"
                  placeholder="BYD"
                  value={carBrand}
                  onChange={(e) => setCarBrand(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="d-carModel" style={labelStyle}>
                  Model
                </label>
                <input
                  id="d-carModel"
                  type="text"
                  placeholder="F3"
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <label htmlFor="d-modelYear" style={labelStyle}>
                  Model year
                </label>
                <input
                  id="d-modelYear"
                  type="number"
                  inputMode="numeric"
                  placeholder="2024"
                  value={modelYear}
                  onChange={(e) =>
                    setModelYear(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="d-vehicleColor" style={labelStyle}>
                  Color
                </label>
                <input
                  id="d-vehicleColor"
                  type="text"
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>License plate</label>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  direction: "rtl",
                }}
              >
                {[
                  [
                    plateChar1,
                    setPlateChar1,
                    plateChar1Ref,
                    plateChar2Ref,
                  ] as const,
                  [
                    plateChar2,
                    setPlateChar2,
                    plateChar2Ref,
                    plateChar3Ref,
                  ] as const,
                  [
                    plateChar3,
                    setPlateChar3,
                    plateChar3Ref,
                    plateDigitsRef,
                  ] as const,
                ].map(([val, setVal, currentRef, nextRef], i) => (
                  <input
                    key={i}
                    ref={currentRef}
                    type="text"
                    inputMode="text"
                    maxLength={1}
                    value={val}
                    onChange={(e) => {
                      const ch = e.target.value
                        .replace(/[^\u0600-\u06FF]/g, "")
                        .slice(-1);
                      setVal(ch);
                      if (ch) {
                        nextRef.current?.focus();
                      }
                    }}
                    style={{
                      ...inputStyle,
                      textAlign: "center",
                      width: 52,
                      flexShrink: 0,
                    }}
                  />
                ))}
                <input
                  ref={plateDigitsRef}
                  type="text"
                  inputMode="numeric"
                  minLength={3}
                  maxLength={4}
                  placeholder="987"
                  value={plateDigits}
                  onChange={(e) =>
                    setPlateDigits(
                      e.target.value.replace(/\D/g, "").slice(0, 4),
                    )
                  }
                  style={{ ...inputStyle, textAlign: "center", flex: 1 }}
                />
              </div>
            </div>
            <div>
              <label htmlFor="d-expiry" style={labelStyle}>
                License expiry
              </label>
              <input
                id="d-expiry"
                type="date"
                value={licenseExpiry}
                onChange={(e) => setLicenseExpiry(e.target.value)}
                style={inputStyle}
              />
            </div>
            <p
              style={{
                fontSize: 12,
                color: "#5A6A7A",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Calendar size={13} aria-hidden="true" /> Profile since{" "}
              {profileSinceLabel}
            </p>
            {detailsMsg && (
              <p
                role="status"
                aria-live="polite"
                style={{
                  fontSize: 13,
                  margin: 0,
                  color: detailsMsg.ok ? "#27AE60" : "#e74c3c",
                }}
              >
                {detailsMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={savingDetails}
              style={saveButtonStyle(savingDetails)}
            >
              {savingDetails ? (
                <Loader2 size={16} className="spin" aria-hidden="true" />
              ) : (
                <Check size={16} aria-hidden="true" />
              )}
              {savingDetails ? "Saving…" : "Save"}
            </button>
          </form>
        </Section>

        {/* Documents */}
        <Section title="Documents">
          <ProgressBar
            pct={docsPct}
            filled={docsFilledCount}
            total={DOCUMENTS.length}
          />
          <div style={{ ...cardStyle, gap: 10 }}>
            {DOCUMENTS.map((doc) => {
              const path = documents[doc.key];
              const done = Boolean(path);
              const busy = Boolean(uploading[doc.key]);
              return (
                <div
                  key={doc.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    minHeight: 52,
                    background: "#f8f9fa",
                    border: `1.5px solid ${done ? "#00C2A8" : "#e8edf0"}`,
                    borderRadius: 12,
                  }}
                >
                  <FileText
                    size={18}
                    style={{
                      color: done ? "#00C2A8" : "#5A6A7A",
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  <input
                    ref={(el) => {
                      fileInputs.current[doc.key] = el;
                    }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    id={`pdoc-${doc.key}`}
                    style={{ display: "none" }}
                    onChange={(e) =>
                      handleFileChange(doc.key, e.target.files?.[0] ?? null)
                    }
                  />
                  <label
                    htmlFor={`pdoc-${doc.key}`}
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#0B1E3D",
                      cursor: "pointer",
                    }}
                  >
                    {doc.label}
                  </label>
                  {done && (
                    <a
                      href={path ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#00806E",
                        textDecoration: "none",
                      }}
                    >
                      View
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputs.current[doc.key]?.click()}
                    disabled={busy}
                    aria-label={
                      done ? `Replace ${doc.label}` : `Upload ${doc.label}`
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      minHeight: 40,
                      padding: "0 14px",
                      borderRadius: 9,
                      border: "none",
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      cursor: busy ? "not-allowed" : "pointer",
                      background: done ? "#E6F8F5" : "#0B1E3D",
                      color: done ? "#00806E" : "#ffffff",
                    }}
                  >
                    {busy ? (
                      <Loader2 size={14} className="spin" aria-hidden="true" />
                    ) : done ? (
                      <Check size={14} aria-hidden="true" />
                    ) : (
                      <Upload size={14} aria-hidden="true" />
                    )}
                    {busy ? "Uploading…" : done ? "Replace" : "Upload"}
                  </button>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Submit for review */}
        {verificationStatus === "incomplete" && (
          <div style={{ ...cardStyle, marginTop: 4 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#5A6A7A" }}>
              Once your driver details and all documents are filled in, submit
              your profile for review.
            </p>
            {!canSubmit && (
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "#E65100",
                  padding: "6px 10px",
                  background: "#FFF3E0",
                  borderRadius: 8,
                }}
              >
                Complete all driver details ({detailsPct}%) and upload all
                documents ({docsPct}%) to enable submission.
              </p>
            )}
            {submitMsg && (
              <p
                role="status"
                aria-live="polite"
                style={{
                  fontSize: 13,
                  margin: 0,
                  color: submitMsg.ok ? "#27AE60" : "#e74c3c",
                }}
              >
                {submitMsg.text}
              </p>
            )}
            <button
              type="button"
              onClick={submitForReview}
              disabled={submitting || !canSubmit}
              style={saveButtonStyle(submitting || !canSubmit)}
            >
              {submitting ? (
                <Loader2 size={16} className="spin" aria-hidden="true" />
              ) : (
                <Check size={16} aria-hidden="true" />
              )}
              {submitting ? "Submitting…" : "Submit for review"}
            </button>
          </div>
        )}

        <Section title="Security">
          <ChangePasswordSection />
        </Section>

        <SavedAddressesSection initialAddresses={initialSavedAddresses} />
      </main>
    </div>
  );
}
