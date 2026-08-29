"use client";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Car,
  Check,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import { CAR_TYPE_LIST, type CarType } from "@/lib/config/driver";
import { useClientLocale } from "@/lib/locale.client";
import { useRouter } from "next/navigation";

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
  { key: "nationalIdFront", label: "documents.nationalIdFront" },
  { key: "nationalIdBack", label: "documents.nationalIdBack" },
  { key: "drivingLicense", label: "documents.drivingLicense" },
  { key: "carLicenseFront", label: "documents.carLicenseFront" },
  { key: "carLicenseBack", label: "documents.carLicenseBack" },
  { key: "criminalRecord", label: "documents.criminalRecord" },
  { key: "profilePic", label: "documents.profilePic" },
  { key: "carImage", label: "documents.carImage" },
];

interface Props {
  email: string;
  name: string;
  phone: string;
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

function getSelectStyle(dir: "ltr" | "rtl"): React.CSSProperties {
  const isRtl = dir === "rtl";
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

function actionButtonStyle(loading: boolean, variant: "primary" | "ghost" = "primary"): React.CSSProperties {
  if (variant === "ghost") {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 46,
      padding: "0 20px",
      background: "#ffffff",
      color: "#0B1E3D",
      fontWeight: 700,
      fontSize: 14,
      border: "1.5px solid #e2e8ed",
      borderRadius: 10,
      cursor: "pointer",
      fontFamily: "inherit",
    };
  }
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    padding: "0 22px",
    background: loading ? "#5A6A7A" : "#0B1E3D",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 14,
    border: "none",
    borderRadius: 10,
    cursor: loading ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  };
}

const STEPS = [
  { key: "vehicle", label: "Vehicle details" },
  { key: "documents", label: "Documents" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

function Stepper({ current, completed }: { current: number; completed: Record<StepKey, boolean> }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 28 }}>
      {STEPS.map((step, index) => {
        const isCurrent = index === current;
        const isDone = completed[step.key] && index !== current;
        const isPast = index < current;
        const circleActive = isCurrent || isPast || completed[step.key];
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center", flex: index < STEPS.length - 1 ? 1 : "0 0 auto" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 800,
                  flexShrink: 0,
                  background: isDone ? "#00C2A8" : isCurrent ? "#0B1E3D" : "#eef0f3",
                  color: isDone || isCurrent ? "#ffffff" : "#5A6A7A",
                  border: isCurrent ? "3px solid rgba(11,30,61,0.15)" : "none",
                  boxSizing: "content-box",
                  transition: "background 0.2s ease",
                }}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isDone ? <Check size={16} /> : index + 1}
              </div>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: isCurrent ? 700 : 500,
                  color: circleActive ? "#0B1E3D" : "#5A6A7A",
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  margin: "0 10px",
                  marginBottom: 22,
                  background: isPast || completed[step.key] ? "#00C2A8" : "#e8edf0",
                  transition: "background 0.2s ease",
                  minWidth: 24,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DriverVerificationClient({
  email,
  name,
  phone,
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
}: Props) {
  const { dir, t } = useClientLocale();
  const router = useRouter();
  const selectStyle = getSelectStyle(dir);
  const [step, setStep] = useState<0 | 1>(0);

  // Vehicle details
  const [carType, setCarType] = useState<CarType | "">(initialCarType);
  const [carBrand, setCarBrand] = useState(initialCarBrand);
  const [carModel, setCarModel] = useState(initialCarModel);
  const [modelYear, setModelYear] = useState(initialModelYear ? String(initialModelYear) : "");
  const [vehicleColor, setVehicleColor] = useState(initialVehicleColor);
  const [plateChar1, setPlateChar1] = useState(initialPlateChar1);
  const [plateChar2, setPlateChar2] = useState(initialPlateChar2);
  const [plateChar3, setPlateChar3] = useState(initialPlateChar3);
  const [plateDigits, setPlateDigits] = useState(initialPlateDigits);
  const [licenseExpiry, setLicenseExpiry] = useState(initialLicenseExpiry);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const capacity = carType ? CAR_TYPE_LIST.find((c) => c.key === carType)?.capacity : carCapacity;

  // Documents
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const plateChar1Ref = useRef<HTMLInputElement>(null);
  const plateChar2Ref = useRef<HTMLInputElement>(null);
  const plateChar3Ref = useRef<HTMLInputElement>(null);
  const plateDigitsRef = useRef<HTMLInputElement>(null);

  const [verificationStatus, setVerificationStatus] = useState(initialVerificationStatus);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const DETAIL_FIELDS = [
    carType,
    carBrand.trim(),
    carModel.trim(),
    (() => {
      const y = Number(modelYear);
      return modelYear.trim() && Number.isInteger(y) && y >= 1900 && y <= 2100 ? modelYear : "";
    })(),
    vehicleColor.trim(),
    /^[\u0600-\u06FF]$/.test(plateChar1) ? plateChar1 : "",
    /^[\u0600-\u06FF]$/.test(plateChar2) ? plateChar2 : "",
    /^[\u0600-\u06FF]$/.test(plateChar3) ? plateChar3 : "",
    /^\d{3,4}$/.test(plateDigits) ? plateDigits : "",
    licenseExpiry.trim(),
  ];
  const detailsFilledCount = DETAIL_FIELDS.filter(Boolean).length;
  const detailsPct = Math.round((detailsFilledCount / DETAIL_FIELDS.length) * 100);
  const detailsComplete = detailsPct === 100;

  const docsFilledCount = DOCUMENTS.filter((d) => Boolean(documents[d.key])).length;
  const docsPct = Math.round((docsFilledCount / DOCUMENTS.length) * 100);
  const docsComplete = docsPct === 100;

  const canSubmit = detailsComplete && docsComplete;
  const completed = useMemo<Record<StepKey, boolean>>(
    () => ({ vehicle: detailsComplete, documents: docsComplete }),
    [detailsComplete, docsComplete],
  );

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
      setDetailsMsg({ ok: false, text: t("error.details_required") });
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
        setDetailsMsg({ ok: false, text: data.error ?? t("error.save_failed") });
        return;
      }
      setDetailsMsg({ ok: true, text: t("action.saved") });
      setStep(1);
    } catch {
      setDetailsMsg({ ok: false, text: t("error.network") });
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
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
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
          : (data.error ?? t("error.submit_failed"));
        setSubmitMsg({ ok: false, text: missingText });
        return;
      }
      setVerificationStatus("pending");
      setSubmitMsg({ ok: true, text: t("profile.submit_review_success") });
    } catch {
      setSubmitMsg({ ok: false, text: t("error.network") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader authed email={email} role="driver" variant="app" backHref="/profile" />

      <style>{`
        .verification-shell { max-width: 560px; margin: 0 auto; padding: 32px 20px 64px; }
        @media (min-width: 900px) {
          .verification-shell { max-width: 680px; padding: 48px 32px 80px; }
        }
      `}</style>

      <main dir={dir} className="verification-shell">
        <div style={{ marginBottom: 4 }}>
          <p style={{ margin: 0, color: "#00877A", fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {t("verification.eyebrow")}
          </p>
          <h1 style={{ margin: "6px 0 20px", color: "#0B1E3D", fontSize: 24 }}>{t("verification.title")}</h1>
        </div>

        <Stepper current={step} completed={completed} />

        {step === 0 ? (
          <form onSubmit={saveDetails} noValidate style={cardStyle}>
            <div>
              <label htmlFor="d-carType" style={labelStyle}>{t("profile.car_type")}</label>
              <select id="d-carType" value={carType} onChange={(e) => setCarType(e.target.value as CarType)} style={selectStyle}>
                <option value="">{t("select.placeholder")}</option>
                {CAR_TYPE_LIST.map((c) => (
                  <option key={c.key} value={c.key}>{t(`vehicles.${c.key}`) || c.label}</option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: "#5A6A7A", marginTop: 5, marginBottom: 0, display: "flex", alignItems: "center", gap: 5 }}>
                <Car size={13} aria-hidden="true" /> {t("profile.capacity_label")} {capacity ?? "—"} {t("profile.capacity_note")}
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label htmlFor="d-carBrand" style={labelStyle}>{t("profile.car_brand")}</label>
                <input id="d-carBrand" type="text" placeholder="BYD" value={carBrand} onChange={(e) => setCarBrand(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label htmlFor="d-carModel" style={labelStyle}>{t("profile.car_model")}</label>
                <input id="d-carModel" type="text" placeholder="F3" value={carModel} onChange={(e) => setCarModel(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label htmlFor="d-modelYear" style={labelStyle}>{t("profile.model_year")}</label>
                <input
                  id="d-modelYear"
                  type="number"
                  inputMode="numeric"
                  placeholder="2024"
                  value={modelYear}
                  onChange={(e) => setModelYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="d-vehicleColor" style={labelStyle}>{t("profile.vehicle_color")}</label>
                <input id="d-vehicleColor" type="text" value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t("profile.plate_letters")} / {t("profile.plate_numbers")}</label>
              <div dir="rtl" style={{ display: "flex", gap: 8, direction: "rtl" }}>
                {[
                  [plateChar1, setPlateChar1, plateChar1Ref, plateChar2Ref] as const,
                  [plateChar2, setPlateChar2, plateChar2Ref, plateChar3Ref] as const,
                  [plateChar3, setPlateChar3, plateChar3Ref, plateDigitsRef] as const,
                ].map(([val, setVal, currentRef, nextRef], i) => (
                  <input
                    key={i}
                    ref={currentRef}
                    dir="rtl"
                    type="text"
                    inputMode="text"
                    maxLength={1}
                    value={val}
                    onChange={(e) => {
                      const ch = e.target.value.replace(/[^\u0600-\u06FF]/g, "").slice(-1);
                      setVal(ch);
                      if (ch) nextRef.current?.focus();
                    }}
                    style={{ ...inputStyle, textAlign: "center", width: 52, flexShrink: 0 }}
                  />
                ))}
                <input
                  ref={plateDigitsRef}
                  dir="rtl"
                  type="text"
                  inputMode="numeric"
                  minLength={3}
                  maxLength={4}
                  placeholder="987"
                  value={plateDigits}
                  onChange={(e) => setPlateDigits(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  style={{ ...inputStyle, textAlign: "center", flex: 1 }}
                />
              </div>
            </div>
            <div>
              <label htmlFor="d-expiry" style={labelStyle}>{t("profile.license_expiry")}</label>
              <input id="d-expiry" type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} style={inputStyle} />
            </div>
            <p style={{ fontSize: 12, color: "#5A6A7A", margin: 0, display: "flex", alignItems: "center", gap: 5 }}>
              <Calendar size={13} aria-hidden="true" /> {t("profile.profile_since")} {profileSinceLabel}
            </p>
            {detailsMsg && (
              <p role="status" aria-live="polite" style={{ fontSize: 13, margin: 0, color: detailsMsg.ok ? "#27AE60" : "#e74c3c" }}>
                {detailsMsg.text}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="submit" disabled={savingDetails} style={actionButtonStyle(savingDetails)}>
                {savingDetails ? <Loader2 size={16} className="spin" aria-hidden="true" /> : null}
                {savingDetails ? t("action.saving") : t("verification.save_and_continue")}
                {!savingDetails ? (dir === "rtl" ? <ArrowLeft size={16} /> : <ArrowRight size={16} />) : null}
              </button>
            </div>
          </form>
        ) : (
          <>
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
                    <FileText size={18} style={{ color: done ? "#00C2A8" : "#5A6A7A", flexShrink: 0 }} aria-hidden="true" />
                    <input
                      ref={(el) => { fileInputs.current[doc.key] = el; }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      id={`vdoc-${doc.key}`}
                      style={{ display: "none" }}
                      onChange={(e) => handleFileChange(doc.key, e.target.files?.[0] ?? null)}
                    />
                    <label htmlFor={`vdoc-${doc.key}`} style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "#0B1E3D", cursor: "pointer" }}>
                      {t(doc.label)}
                    </label>
                    {done && (
                      <a href={path ?? undefined} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#00806E", textDecoration: "none" }}>
                        {t("doc.view")}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputs.current[doc.key]?.click()}
                      disabled={busy}
                      aria-label={done ? `${t("doc.replace")} ${t(doc.label)}` : `${t("doc.upload")} ${t(doc.label)}`}
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
                      {busy ? <Loader2 size={14} className="spin" aria-hidden="true" /> : done ? <Check size={14} aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
                      {busy ? t("doc.uploading") : done ? t("doc.replace") : t("doc.upload")}
                    </button>
                  </div>
                );
              })}
            </div>

            {verificationStatus === "incomplete" && (
              <div style={{ ...cardStyle, marginTop: 16 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#5A6A7A" }}>{t("profile.subtitle")}</p>
                {!canSubmit && (
                  <p style={{ margin: 0, fontSize: 12, color: "#E65100", padding: "6px 10px", background: "#FFF3E0", borderRadius: 8 }}>
                    {t("profile.complete_details_start")}{detailsPct}{t("profile.complete_details_middle")}{docsPct}{t("profile.complete_details_end")}
                  </p>
                )}
                {submitMsg && (
                  <p role="status" aria-live="polite" style={{ fontSize: 13, margin: 0, color: submitMsg.ok ? "#27AE60" : "#e74c3c" }}>
                    {submitMsg.text}
                  </p>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => setStep(0)} style={actionButtonStyle(false, "ghost")}>
                    {dir === "rtl" ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                    {t("verification.back")}
                  </button>
                  <button type="button" onClick={submitForReview} disabled={submitting || !canSubmit} style={actionButtonStyle(submitting || !canSubmit)}>
                    {submitting ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                    {submitting ? t("action.submitting") : t("profile.submit_review")}
                  </button>
                </div>
              </div>
            )}

            {verificationStatus !== "incomplete" && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16 }}>
                <button type="button" onClick={() => setStep(0)} style={actionButtonStyle(false, "ghost")}>
                  {dir === "rtl" ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                  {t("verification.back")}
                </button>
                <button type="button" onClick={() => router.push("/profile")} style={actionButtonStyle(false)}>
                  {t("verification.done")}
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 0.8s linear infinite; }`}</style>
    </div>
  );
}
