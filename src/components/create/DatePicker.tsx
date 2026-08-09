"use client";
import { Calendar, Check } from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { bookingWindow } from "@/lib/time/bookingDates";
import { useClientLocale } from "@/lib/locale.client";
import { toArabicDigits } from "@/lib/i18n";

interface Props {
  value: string[]; // selected "YYYY-MM-DD" dates
  onChange: (dates: string[]) => void;
}

export default function DatePicker({ value, onChange }: Props) {
  const days = bookingWindow();
  const { t, locale } = useClientLocale();
  const dateLocale = locale === "ar" ? ar : enUS;

  function toggle(day: string) {
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day].sort());
    }
  }

  return (
    <div>
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#0B1E3D",
          margin: "0 0 10px",
        }}
      >
        {t("create.request_dates")}
      </p>
      <div
        role="group"
        aria-label={t("create.select_dates_aria")}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
          gap: 8,
        }}
      >
        {days.map((day) => {
          const d = new Date(`${day}T00:00:00`);
          const selected = value.includes(day);
          const weekday = format(d, "EEE", { locale: dateLocale });
          const monthDay = format(d, "MMM d", { locale: dateLocale });
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggle(day)}
              aria-pressed={selected}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                padding: "10px 6px",
                borderRadius: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                border: `1.5px solid ${selected ? "#00C2A8" : "#c8e8e4"}`,
                background: selected ? "#00C2A8" : "#eff7f6",
                color: selected ? "#ffffff" : "#0B1E3D",
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              {selected && (
                <Check
                  size={12}
                  style={{ position: "absolute", top: 6, right: 6 }}
                  aria-hidden="true"
                />
              )}
              <Calendar
                size={16}
                style={{ color: selected ? "#ffffff" : "#00C2A8" }}
                aria-hidden="true"
              />
              <span style={{ fontSize: 11, fontWeight: 600 }}>
                {weekday}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800 }}>
                {locale === "ar" ? toArabicDigits(monthDay) : monthDay}
              </span>
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: "#5A6A7A", margin: "8px 0 0" }}>
        {t("create.pick_days_note")}
      </p>
      {value.length === days.length && days.every((day) => value.includes(day)) && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            fontWeight: 700,
            color: "#15803d",
          }}
        >
          Full week selected — 5% off applies to the 7th-day trips.
        </p>
      )}
    </div>
  );
}
