"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function remainingLabel(date: string, pickupTime: string, locale: "en" | "ar") {
  const pickup = new Date(`${date}T${pickupTime}:00`);
  const remainingMs = pickup.getTime() - Date.now();
  if (!Number.isFinite(pickup.getTime()) || remainingMs <= 0) {
    return locale === "ar" ? "وقت الركوب الآن" : "Pickup time is now";
  }

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const value = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return locale === "ar" ? `الركوب خلال ${value}` : `Pickup in ${value}`;
}

export default function MatchedTripCountdown({
  date,
  pickupTime,
  locale,
}: {
  date: string;
  pickupTime: string;
  locale: "en" | "ar";
}) {
  const [label, setLabel] = useState(() =>
    remainingLabel(date, pickupTime, locale),
  );

  useEffect(() => {
    const update = () => setLabel(remainingLabel(date, pickupTime, locale));
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, [date, pickupTime, locale]);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        fontWeight: 700,
        color: "#00806E",
      }}
    >
      <Clock size={13} aria-hidden="true" />
      {label}
    </span>
  );
}
