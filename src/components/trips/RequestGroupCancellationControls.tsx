"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RequestGroupCancellationControlsProps {
  requestId: string;
  trips: { id: string; date: string; priceEgp: number }[];
  locale: "en" | "ar";
}

export default function RequestGroupCancellationControls({
  requestId,
  trips,
  locale,
}: RequestGroupCancellationControlsProps) {
  const router = useRouter();
  const [selectedTrip, setSelectedTrip] =
    useState<RequestGroupCancellationControlsProps["trips"][number] | null>(null);
  const [cancelAll, setCancelAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const newAmount = cancelAll
    ? 0
    : trips.reduce(
        (total, trip) =>
          trip.id === selectedTrip?.id ? total : total + trip.priceEgp,
        0,
      );
  const formatAmount = (amount: number) =>
    `${amount.toLocaleString(locale === "ar" ? "ar-EG" : "en-EG")} EGP`;

  async function submitCancellation() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        cancelAll
          ? `/api/requests/${requestId}/cancel`
          : `/api/trips/${selectedTrip?.id}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: cancelAll
              ? "Passenger cancelled Request before payment"
              : "Passenger cancelled day before payment",
          }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        amountEgp?: number;
      };
      if (!response.ok) {
        setError(payload.error ?? "Unable to cancel this Request.");
        return;
      }

      setNotice(`Updated group total: ${formatAmount(payload.amountEgp ?? newAmount)}`);
      setSelectedTrip(null);
      setCancelAll(false);
      router.refresh();
    } catch {
      setError("Unable to cancel this Request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const cancelLabels =
    locale === "ar"
      ? { day: "إلغاء هذا اليوم", all: "إلغاء كل الأيام", close: "إغلاق", confirm: "تأكيد الإلغاء" }
      : { day: "Cancel day", all: "Cancel all days", close: "Close", confirm: "Confirm cancellation" };

  return (
    <div style={{ borderTop: "1px solid #f4f6f8", padding: "12px 18px" }}>
      {notice && (
        <p role="status" style={{ margin: "0 0 10px", color: "#006D60", fontSize: 13 }}>
          {notice}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {trips.map((trip) => (
          <button
            key={trip.id}
            type="button"
            onClick={() => setSelectedTrip(trip)}
            disabled={busy}
            style={buttonStyle}
          >
            {cancelLabels.day} · {trip.date}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCancelAll(true)}
          disabled={busy}
          style={buttonStyle}
        >
          {cancelLabels.all}
        </button>
      </div>

      {(selectedTrip || cancelAll) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-cancel-title"
          style={dialogBackdrop}
        >
          <div style={dialogStyle}>
            <h2 id="request-cancel-title" style={{ margin: "0 0 8px", color: "#0B1E3D", fontSize: 18 }}>
              {cancelLabels.confirm}
            </h2>
            <p style={{ margin: "0 0 16px", color: "#526262" }}>
              {cancelAll
                ? locale === "ar"
                  ? "سيتم إلغاء كل الأيام. المبلغ الجديد: 0 EGP."
                  : "All days will be cancelled. The new total will be 0 EGP."
                : locale === "ar"
                  ? `سيتم إلغاء اليوم المحدد. المبلغ الجديد: ${formatAmount(newAmount)}.`
                  : `This day will be cancelled. The new total will be ${formatAmount(newAmount)}.`}
            </p>
            {error && (
              <p role="alert" style={{ margin: "0 0 12px", color: "#C0392B" }}>
                {error}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedTrip(null);
                  setCancelAll(false);
                  setError("");
                }}
                disabled={busy}
                style={buttonStyle}
              >
                {cancelLabels.close}
              </button>
              <button
                type="button"
                onClick={submitCancellation}
                disabled={busy}
                style={{ ...buttonStyle, background: "#0B1E3D", color: "#fff" }}
              >
                {busy ? "…" : cancelLabels.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const buttonStyle = {
  border: "1px solid #D6E2E0",
  borderRadius: 8,
  background: "#fff",
  color: "#0B1E3D",
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
} as const;

const dialogBackdrop = {
  position: "fixed" as const,
  inset: 0,
  zIndex: 100,
  display: "grid",
  placeItems: "center",
  background: "rgba(11, 30, 61, 0.45)",
  padding: 20,
};

const dialogStyle = {
  width: "min(100%, 420px)",
  borderRadius: 14,
  background: "#fff",
  padding: 20,
  boxShadow: "0 16px 48px rgba(11, 30, 61, 0.2)",
};
