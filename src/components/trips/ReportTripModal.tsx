"use client";
import { useState } from "react";
import { Flag, AlertCircle } from "lucide-react";

const REPORT_CATEGORIES = [
  { key: "vehicle_condition", labelEn: "Vehicle was in poor condition", labelAr: "حالة العربية كانت سيئة" },
  { key: "driver_behavior", labelEn: "Driver was rude or unprofessional", labelAr: "السواق كان غير محترم أو غير مهني" },
  { key: "route_issue", labelEn: "Wrong or inefficient route taken", labelAr: "المسار كان خطأ أو غير فعال" },
  { key: "safety_concern", labelEn: "Safety concern (speeding, reckless driving)", labelAr: "مشكلة أمان (سرعة زائدة، قيادة متهورة)" },
  { key: "pricing_issue", labelEn: "Pricing or billing issue", labelAr: "مشكلة في السعر أو الفاتورة" },
  { key: "cleanliness", labelEn: "Vehicle was not clean", labelAr: "العربية مش نضيفة" },
  { key: "other", labelEn: "Other issue", labelAr: "مشكلة أخرى" },
] as const;

export default function ReportTripModal({
  tripId,
  locale = "en",
  hasExistingReport = false,
}: {
  tripId: string;
  locale?: "en" | "ar";
  hasExistingReport?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const t = (en: string, ar: string) => (locale === "ar" ? ar : en);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!category) {
      setError(t("Please select a category", "برجاء اختيار فئة"));
      return;
    }

    if (description.trim().length < 5) {
      setError(
        t("Description must be at least 5 characters", "الوصف يجب أن يكون 5 أحرف على الأقل"),
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/trips/${tripId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, description }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t("Failed to submit report", "فشل إرسال البلاغ"));
      }

      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        window.location.reload();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("An error occurred", "حدث خطأ"));
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (key: string) => {
    setCategory(key);
    setError(null);
  };

  if (hasExistingReport) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          borderRadius: 10,
          background: "#EEF2F2",
          color: "#526262",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <Flag size={14} aria-hidden="true" />
        {t("Report submitted", "تم إرسال البلاغ")}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minHeight: 44,
          padding: "0 16px",
          borderRadius: 8,
          border: "1px solid #E74C3C",
          background: "#fff",
          color: "#E74C3C",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          width: "100%",
        }}
        type="button"
      >
        <Flag size={16} aria-hidden="true" />
        {t("Report issue", "الإبلاغ عن مشكلة")}
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(11,30,61,0.4)",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              maxWidth: 520,
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 12px 40px rgba(11,30,61,0.2)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #EEF2F2",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#0B1E3D",
                }}
              >
                {t("Report an issue", "الإبلاغ عن مشكلة")}
              </h2>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 13,
                  color: "#5A6A7A",
                  lineHeight: 1.5,
                }}
              >
                {t(
                  "Help us improve by reporting any issues with your trip",
                  "ساعدنا في التحسين بالإبلاغ عن أي مشكلة في رحلتك",
                )}
              </p>
            </div>

            {/* Body */}
            <form
              onSubmit={handleSubmit}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px",
                display: "grid",
                gap: 20,
              }}
            >
              {success ? (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: 10,
                    background: "#E8F5E9",
                    color: "#166B48",
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: "center",
                  }}
                >
                  {t("Report submitted successfully", "تم إرسال البلاغ بنجاح")}
                </div>
              ) : (
                <>
                  {/* Category selection */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#0B1E3D",
                      }}
                    >
                      {t("What went wrong?", "ما المشكلة؟")} <span style={{ color: "#E74C3C" }}>*</span>
                    </label>
                    <div style={{ display: "grid", gap: 8 }}>
                      {REPORT_CATEGORIES.map((cat) => (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => handleCategorySelect(cat.key)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "12px 14px",
                            borderRadius: 10,
                            border: `1.5px solid ${category === cat.key ? "#00C2A8" : "#DCE6E4"}`,
                            background: category === cat.key ? "#E8F8F5" : "#fff",
                            color: category === cat.key ? "#006D60" : "#0B1E3D",
                            fontSize: 14,
                            fontWeight: category === cat.key ? 700 : 600,
                            textAlign: "start",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <span
                            style={{
                              display: "grid",
                              placeItems: "center",
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              border: `2px solid ${category === cat.key ? "#00C2A8" : "#B9CBC6"}`,
                              background: category === cat.key ? "#00C2A8" : "#fff",
                              flexShrink: 0,
                            }}
                          >
                            {category === cat.key && (
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  background: "#fff",
                                }}
                              />
                            )}
                          </span>
                          {locale === "ar" ? cat.labelAr : cat.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label
                      htmlFor="report-description"
                      style={{
                        display: "block",
                        marginBottom: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#0B1E3D",
                      }}
                    >
                      {t("Additional details", "تفاصيل إضافية")} <span style={{ color: "#E74C3C" }}>*</span>
                    </label>
                    <textarea
                      id="report-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t(
                        "Please describe the issue in detail...",
                        "برجاء وصف المشكلة بالتفصيل...",
                      )}
                      rows={5}
                      maxLength={1000}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: "1.5px solid #DCE6E4",
                        fontSize: 14,
                        fontFamily: "inherit",
                        resize: "vertical",
                        minHeight: 120,
                      }}
                    />
                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: 12,
                        color: "#9aa7b4",
                        textAlign: locale === "ar" ? "right" : "left",
                      }}
                    >
                      {description.length} / 1000
                    </p>
                  </div>

                  {error && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: "#FFEBEE",
                        color: "#8F2D28",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                      {error}
                    </div>
                  )}
                </>
              )}
            </form>

            {/* Footer */}
            {!success && (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "16px 24px",
                  borderTop: "1px solid #EEF2F2",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    padding: "0 16px",
                    borderRadius: 8,
                    border: "1px solid #DCE6E4",
                    background: "#fff",
                    color: "#5A6A7A",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {t("Cancel", "إلغاء")}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || !category || description.trim().length < 5}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    padding: "0 16px",
                    borderRadius: 8,
                    border: "none",
                    background: loading || !category || description.trim().length < 5 ? "#DCE6E4" : "#E74C3C",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor:
                      loading || !category || description.trim().length < 5
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {loading ? t("Submitting...", "جاري الإرسال...") : t("Submit report", "إرسال البلاغ")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
