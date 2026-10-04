"use client";

import { useEffect, useRef, useState } from "react";
import { getCountdown, type Countdown } from "@/lib/countdown";
import { toArabicDigits, translate } from "@/lib/i18n";

function digit(locale: "en" | "ar", value: number): string {
  const formatted = String(value);
  return locale === "ar" ? toArabicDigits(formatted) : formatted;
}

function countdownText(countdown: Countdown, locale: "en" | "ar") {
  const units =
    countdown.days > 0
      ? [
          [countdown.days, "my_trips.countdown_day_short"],
          [countdown.hours, "my_trips.countdown_hour_short"],
        ]
      : countdown.totalSeconds >= 3600
        ? [
            [countdown.hours, "my_trips.countdown_hour_short"],
            [countdown.minutes, "my_trips.countdown_minute_short"],
          ]
        : [
            [countdown.minutes, "my_trips.countdown_minute_short"],
            [countdown.seconds, "my_trips.countdown_second_short"],
          ];

  return units.map(([value, key]) => ({
    value: digit(locale, Number(value)),
    label: translate(locale, String(key)),
  }));
}

function accessibleText(countdown: Countdown, locale: "en" | "ar") {
  return countdownText(countdown, locale)
    .map(({ value, label }) => `${value} ${label}`)
    .join(" ");
}

export default function NextTripCountdown({
  pickupAt,
  initialCountdown,
  locale,
  ongoing,
}: {
  pickupAt: string;
  initialCountdown: Countdown | null;
  locale: "en" | "ar";
  ongoing: boolean;
}) {
  const [countdown, setCountdown] = useState(initialCountdown);
  const [announcement, setAnnouncement] = useState(() =>
    initialCountdown?.state === "reached"
      ? translate(locale, "my_trips.pickup_reached")
      : initialCountdown
        ? accessibleText(initialCountdown, locale)
        : "",
  );
  const announcedMinute = useRef(
    initialCountdown ? Math.floor(initialCountdown.totalSeconds / 60) : -1,
  );

  useEffect(() => {
    if (ongoing || !initialCountdown) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const clearTimer = () => {
      if (timeout !== null) clearTimeout(timeout);
      timeout = null;
    };
    const refresh = () => {
      clearTimer();
      if (document.visibilityState === "hidden") return;

      const next = getCountdown({ pickupAt, now: new Date() });
      if (!next) return;
      setCountdown(next);
      const minute = Math.floor(next.totalSeconds / 60);
      if (next.state === "reached") {
        setAnnouncement(translate(locale, "my_trips.pickup_reached"));
      } else if (minute !== announcedMinute.current) {
        announcedMinute.current = minute;
        setAnnouncement(accessibleText(next, locale));
      }
      if (next.state === "future") timeout = setTimeout(refresh, next.tickMs);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") clearTimer();
      else refresh();
    };

    refresh();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [initialCountdown, locale, ongoing, pickupAt]);

  if (ongoing) {
    return <span className="next-trip-live-label">{translate(locale, "my_trips.live_now")}</span>;
  }
  if (!countdown) return null;
  if (countdown.state === "reached") {
    return <span className="next-trip-reached-label">{translate(locale, "my_trips.pickup_reached")}</span>;
  }

  return (
    <>
      <div
        className="next-trip-countdown"
        aria-live="off"
        dir={locale === "ar" ? "rtl" : "ltr"}
        style={{ direction: locale === "ar" ? "rtl" : "ltr", unicodeBidi: "isolate" }}
      >
        {countdownText(countdown, locale).map(({ value, label }) => (
          <span className="next-trip-countdown-unit" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </span>
        ))}
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
    </>
  );
}