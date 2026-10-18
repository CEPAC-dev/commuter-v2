"use client";

import { useState } from "react";
import { useClientLocale } from "@/lib/i18n/client";

export default function NoShowReviewNotice({
  tripId,
  paymentStatus,
  requestedAt,
}: {
  tripId: string;
  paymentStatus: string;
  requestedAt?: string | null;
}) {
  const { t } = useClientLocale();
  const [submitted, setSubmitted] = useState(Boolean(requestedAt));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestReview = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/trips/${tripId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_no_show_review" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.errorCode || "REQUEST_FAILED");
      setSubmitted(true);
    } catch {
      setError(t("trip_detail.no_show_review_error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="status"
      style={{
        display: "grid",
        gap: 10,
        padding: 12,
        border: "1px solid #F5A623",
        borderRadius: 10,
        background: "#FFFAF0",
        color: "#0B1E3D",
      }}
    >
      <p style={{ margin: 0, fontSize: 13 }}>
        {t("trip_detail.no_show_review_note")}
      </p>
      {paymentStatus === "paid" &&
        (submitted ? (
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>
            {t("trip_detail.no_show_review_submitted")}
          </p>
        ) : (
          <button
            type="button"
            onClick={requestReview}
            disabled={submitting}
            style={{
              justifySelf: "start",
              border: 0,
              borderRadius: 8,
              padding: "9px 12px",
              background: "#0B1E3D",
              color: "#fff",
              fontWeight: 700,
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            {submitting
              ? t("trip_detail.no_show_review_submitting")
              : t("trip_detail.no_show_review_action")}
          </button>
        ))}
      {error && (
        <p style={{ margin: 0, color: "#8F2D28", fontSize: 12 }}>{error}</p>
      )}
    </div>
  );
}
