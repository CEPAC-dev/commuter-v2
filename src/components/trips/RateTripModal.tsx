"use client";

import { useEffect, useState } from "react";
import { useClientLocale } from "@/lib/locale.client";
import { Star, X } from "lucide-react";

interface RateTripModalProps {
  tripId: string;
  /** Existing rating, if the trip was already rated. */
  initialRating?: { driverRating: number; carRating: number } | null;
  /** Called after a successful submit; use to update local UI (e.g. hide the button). */
  onRated?: () => void;
}

function StarPicker({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div style={{ marginBottom: 18 }}>
      <p
        style={{
          margin: "0 0 8px",
          fontSize: 13,
          fontWeight: 700,
          color: "#0B1E3D",
        }}
      >
        {label}
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = (hover || value) >= n;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => onChange(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                lineHeight: 0,
              }}
            >
              <Star
                size={28}
                color={filled ? "#F5A623" : "#E2E8F0"}
                fill={filled ? "#F5A623" : "none"}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function RateTripModal({ tripId, initialRating, onRated }: RateTripModalProps) {
  const [open, setOpen] = useState(false);
  const [driverRating, setDriverRating] = useState(0);
  const [carRating, setCarRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [rated, setRated] = useState(initialRating ?? null);
  const { t } = useClientLocale();

  useEffect(() => {
    if (!open) return;
    // Reset error when modal opens
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
  }, [open]);

  async function handleSubmit() {
    if (driverRating < 1 || carRating < 1) {
      setError(t("rate_trip.error_missing"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/rating`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverRating, carRating, feedback }),
      });
      if (!res.ok) throw new Error("Failed to submit rating");
      setDone(true);
      setRated({ driverRating, carRating });
      onRated?.();
      setTimeout(() => setOpen(false), 1200);
    } catch {
      setError(t("rate_trip.submit_error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {rated ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            background: "#E8F8F5",
            color: "#00806E",
            border: "1.5px solid #00C2A8",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
          }}
        >
          <Star size={15} fill="#F5A623" color="#F5A623" aria-hidden="true" />
          {t("rate_trip.rated")} · {((rated.driverRating + rated.carRating) / 2).toFixed(1)}
        </span>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            background: "#fff",
            color: "#0B1E3D",
            border: "1.5px solid #0B1E3D",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Star size={15} aria-hidden="true" />
          {t("rate_trip.button")}
        </button>
      )}

      {open && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11,30,61,0.45)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 20,
              width: "100%",
              maxWidth: 420,
              padding: "22px 22px 24px",
              boxShadow: "0 8px 40px rgba(11,30,61,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 800,
                    color: "#0B1E3D",
                  }}
                >
                  {t("rate_trip.title")}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9aa7b4" }}>
                  {t("rate_trip.subtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "#F1F5F9",
                  border: "none",
                  cursor: "pointer",
                  color: "#5A6A7A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {done ? (
              <p style={{ textAlign: "center", color: "#27AE60", fontWeight: 700, padding: "20px 0" }}>
                {t("rate_trip.thanks")}
              </p>
            ) : (
              <>
                <StarPicker value={driverRating} onChange={setDriverRating} label={t("rate_trip.driver")} />
                <StarPicker value={carRating} onChange={setCarRating} label={t("rate_trip.car")} />

                <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#0B1E3D" }}>
                  {t("rate_trip.feedback")} <span style={{ color: "#9aa7b4", fontWeight: 500 }}>{t("rate_trip.feedback_optional")}</span>
                </p>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={t("rate_trip.placeholder")}
                  rows={3}
                  maxLength={1000}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1.5px solid #E2E8F0",
                    fontSize: 13,
                    fontFamily: "inherit",
                    resize: "vertical",
                    outline: "none",
                    color: "#0B1E3D",
                    background: "#F8F9FA",
                  }}
                />

                {error && (
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: "#E74C3C" }}>{error}</p>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    marginTop: 18,
                    width: "100%",
                    padding: "12px 18px",
                    background: submitting
                      ? "#9aa7b4"
                      : "linear-gradient(135deg, #00C2A8 0%, #00A896 100%)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 14,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: submitting ? "default" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {submitting ? "Submitting…" : "Submit rating"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
