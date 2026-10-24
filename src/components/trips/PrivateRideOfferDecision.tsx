"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { formatEgp } from "@/lib/i18n";
import { useClientLocale } from "@/lib/i18n/client";

type PrivateRideOfferDecisionProps = {
  tripId: string;
  currentPriceEgp: number;
  offer: {
    vehicleType: "private_car" | "taxi_private";
    priceEgp: number;
  };
};

export default function PrivateRideOfferDecision({
  tripId,
  currentPriceEgp,
  offer,
}: PrivateRideOfferDecisionProps) {
  const { t, dir, locale } = useClientLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function respond(action: "accept" | "cancel") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/private-ride-offer`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setError(payload?.error || t("private_ride_offer.error"));
        return;
      }
      window.location.reload();
    } catch {
      setError(t("private_ride_offer.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        style={{
          border: "1px solid #00C2A8",
          borderRadius: 8,
          padding: "9px 13px",
          background: "#E8FAF7",
          color: "#0B1E3D",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {t("private_ride_offer.review")}
      </button>
      {open ? (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: 16,
            background: "rgba(11, 30, 61, 0.48)",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="private-ride-offer-title"
            dir={dir}
            style={{
              width: "min(100%, 460px)",
              display: "grid",
              gap: 16,
              padding: 22,
              borderRadius: 14,
              background: "#fff",
              color: "#0B1E3D",
              boxShadow: "0 20px 60px rgba(11, 30, 61, 0.2)",
            }}
          >
            <div>
              <h2
                id="private-ride-offer-title"
                style={{ margin: "0 0 8px", fontSize: 19 }}
              >
                {t("private_ride_offer.title")}
              </h2>
              <p style={{ margin: 0, lineHeight: 1.6, color: "#526262" }}>
                {t("private_ride_offer.description", {
                  oldPrice: formatEgp(locale, currentPriceEgp),
                  newPrice: formatEgp(locale, offer.priceEgp),
                  vehicleType: t(`vehicles.${offer.vehicleType}`),
                })}
              </p>
            </div>
            {error ? (
              <p role="alert" style={{ margin: 0, color: "#B42318" }}>
                {error}
              </p>
            ) : null}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                style={buttonStyle("#fff", "#526262", "#d7dde2")}
              >
                {t("private_ride_offer.close")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void respond("cancel")}
                style={buttonStyle("#fff", "#B42318", "#F2B8B5")}
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                {t("private_ride_offer.cancel_trip")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void respond("accept")}
                style={buttonStyle("#00C2A8", "#0B1E3D", "#00C2A8")}
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                {t("private_ride_offer.accept")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function buttonStyle(background: string, color: string, border: string) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: "9px 12px",
    background,
    color,
    fontWeight: 700,
    cursor: "pointer",
  } as const;
}
