"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { formatEgp, translate } from "@/lib/i18n";

interface RequestGroupCancellationControlsProps {
  requestId: string;
  trips: {
    id: string;
    dateLabel: string;
    pickupTimeLabel: string;
    routeLabel: string;
    priceEgp: number;
    priceLabel: string;
  }[];
  showRoutePerDay: boolean;
  showTimePerDay: boolean;
  paymentAction?: ReactNode;
  waitingNote: string;
  locale: "en" | "ar";
}

export default function RequestGroupCancellationControls({
  requestId,
  trips,
  showRoutePerDay,
  showTimePerDay,
  paymentAction,
  waitingNote,
  locale,
}: RequestGroupCancellationControlsProps) {
  const router = useRouter();
  const [selectedTrip, setSelectedTrip] =
    useState<RequestGroupCancellationControlsProps["trips"][number] | null>(null);
  const [cancelAll, setCancelAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const cancelsWholeBooking = cancelAll || trips.length === 1;
  const newAmount = cancelsWholeBooking
    ? 0
    : trips.reduce(
        (total, trip) =>
          trip.id === selectedTrip?.id ? total : total + trip.priceEgp,
        0,
      );
  const formatAmount = (amount: number) => formatEgp(locale, amount);

  async function submitCancellation() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        cancelsWholeBooking
          ? `/api/requests/${requestId}/cancel`
          : `/api/trips/${selectedTrip?.id}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: cancelsWholeBooking
              ? "Passenger cancelled Request before payment"
              : "Passenger cancelled day before payment",
          }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        errorCode?: string;
        amountEgp?: number;
      };
      if (!response.ok) {
        const paymentInProgress =
          payload.errorCode === "PAYMENT_IN_PROGRESS" ||
          /payment.{0,30}(in progress|session.{0,10}active)|session.{0,20}active/i.test(
            payload.error ?? "",
          );
        setError(
          paymentInProgress
            ? translate(locale, "my_trips.booking_payment_in_progress")
            : payload.error ??
                translate(locale, "my_trips.booking_cancel_error"),
        );
        return;
      }

      setNotice(
        translate(locale, "my_trips.booking_cancel_updated_total", {
          amount: formatAmount(payload.amountEgp ?? newAmount),
        }),
      );
      setSelectedTrip(null);
      setCancelAll(false);
      router.refresh();
    } catch {
      setError(translate(locale, "my_trips.booking_cancel_network_error"));
    } finally {
      setBusy(false);
    }
  }

  function closeDialog() {
    setSelectedTrip(null);
    setCancelAll(false);
    setError("");
  }

  return (
    <>
      {notice && (
        <p role="status" style={{ margin: "8px 0 0", color: "#006D60", fontSize: 13 }}>
          {notice}
        </p>
      )}
      <fieldset
        disabled={busy}
        style={{ minWidth: 0, margin: 0, padding: 0, border: 0 }}
      >
        <div style={{ display: "grid", gap: 0 }}>
          {trips.map((trip) => (
            <div
              key={trip.id}
              className="booking-day-row"
            >
              <div className="booking-day-date">
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#0B1E3D", fontSize: 13, fontWeight: 700 }}>
                    {trip.dateLabel}
                  </span>
                  {showTimePerDay && (
                    <span style={{ color: "#687978", fontSize: 12 }}>
                      {trip.pickupTimeLabel}
                    </span>
                  )}
                </div>
                {showRoutePerDay && (
                  <p style={{ margin: "4px 0 0", color: "#687978", fontSize: 12, lineHeight: 1.4 }}>
                    {trip.routeLabel}
                  </p>
                )}
              </div>
              <span
                className="booking-day-price"
                style={{
                  color: "#0B1E3D",
                  fontSize: 13,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {trip.priceLabel}
              </span>
              <button
                type="button"
                onClick={() => {
                  setNotice("");
                  setError("");
                  setSelectedTrip(trip);
                }}
                className="my-trips-booking-action booking-action-neutral booking-day-cancel"
                aria-label={`${translate(locale, "my_trips.booking_cancel_day")} ${trip.dateLabel}`}
              >
                {translate(locale, "my_trips.booking_cancel_day")}
              </button>
              <Link
                href={`/my-trips/${trip.id}`}
                className="my-trips-booking-action booking-action-icon booking-day-view"
                aria-label={`${translate(locale, "my_trips.view_trip")} · ${trip.dateLabel}`}
              >
                <ChevronRight className="rtl-directional-icon" size={17} aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
        <div className="my-trips-booking-actions">
          {paymentAction ?? (
            <p style={{ margin: 0, color: "#687978", fontSize: 12, lineHeight: 1.5 }}>
              {waitingNote}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setNotice("");
              setError("");
              setCancelAll(true);
            }}
            className="my-trips-booking-action booking-action-danger"
          >
            {translate(locale, "my_trips.booking_cancel_whole")}
          </button>
        </div>
      </fieldset>

      {(selectedTrip || cancelAll) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-cancel-title"
          style={dialogBackdrop}
        >
          <div style={dialogStyle}>
            <h2
              id="request-cancel-title"
              style={{ margin: "0 0 8px", color: "#0B1E3D", fontSize: 18 }}
            >
              {translate(locale, "my_trips.booking_cancel_dialog_title")}
            </h2>
            <p style={{ margin: "0 0 16px", color: "#526262", lineHeight: 1.55 }}>
              {cancelAll
                ? translate(locale, "my_trips.booking_cancel_all_confirmation", {
                    count: trips.length,
                  })
                : trips.length === 1
                  ? translate(locale, "my_trips.booking_cancel_last_day_confirmation", {
                      day: selectedTrip?.dateLabel ?? "",
                      amount: formatAmount(newAmount),
                    })
                  : translate(locale, "my_trips.booking_cancel_day_confirmation", {
                      day: selectedTrip?.dateLabel ?? "",
                      amount: formatAmount(newAmount),
                    })}
            </p>
            {error && (
              <p role="alert" style={{ margin: "0 0 12px", color: "#B54745", fontSize: 13 }}>
                {error}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={closeDialog}
                disabled={busy}
                style={textButtonStyle}
              >
                {translate(locale, "my_trips.booking_cancel_close")}
              </button>
              <button
                type="button"
                onClick={submitCancellation}
                disabled={busy}
                style={confirmButtonStyle}
              >
                {translate(locale, "my_trips.booking_cancel_confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const textButtonStyle = {
  border: 0,
  padding: "5px 2px",
  background: "transparent",
  color: "#667776",
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "underline",
  textUnderlineOffset: 3,
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
  borderRadius: 16,
  background: "#fff",
  padding: 22,
  boxShadow: "0 16px 48px rgba(11, 30, 61, 0.16)",
};

const confirmButtonStyle = {
  border: 0,
  borderRadius: 8,
  background: "#0B1E3D",
  color: "#fff",
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
} as const;
