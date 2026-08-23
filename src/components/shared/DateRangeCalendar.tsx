"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isBefore,
  isSameDay,
  isWithinInterval,
  startOfMonth,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useClientLocale } from "@/lib/i18n/client";

const triggerStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid #e2e8ec",
  borderRadius: 10,
  padding: "9px 14px",
  fontSize: 13,
  fontWeight: 600,
  color: "#0B1E3D",
  fontFamily: "inherit",
  cursor: "pointer",
  background: "#fff",
  minHeight: 38,
};

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export default function DateRangeCalendar() {
  const { t: translate } = useClientLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const dateFromStr = sp.get("dateFrom");
  const dateToStr = sp.get("dateTo");
  const from = parseDate(dateFromStr);
  const to = parseDate(dateToStr);

  const [month, setMonth] = useState(() => from ?? new Date());
  const [draftFrom, setDraftFrom] = useState<Date | null>(from);
  const [draftTo, setDraftTo] = useState<Date | null>(to);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function toggleOpen() {
    if (!open) {
      setDraftFrom(from);
      setDraftTo(to);
      setMonth(from ?? new Date());
    }
    setOpen((o) => !o);
  }

  function pickDay(day: Date) {
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(day);
      setDraftTo(null);
      return;
    }
    if (isBefore(day, draftFrom)) {
      setDraftTo(draftFrom);
      setDraftFrom(day);
    } else {
      setDraftTo(day);
    }
  }

  function apply() {
    const params = new URLSearchParams(sp.toString());
    if (draftFrom) params.set("dateFrom", toKey(draftFrom));
    else params.delete("dateFrom");
    if (draftTo) params.set("dateTo", toKey(draftTo));
    else if (draftFrom) params.delete("dateTo");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
  }

  function clearRange() {
    setDraftFrom(null);
    setDraftTo(null);
    const params = new URLSearchParams(sp.toString());
    params.delete("dateFrom");
    params.delete("dateTo");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
  }

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = getDay(monthStart);

  const label =
    from && to
      ? `${format(from, "MMM d")} – ${format(to, "MMM d")}`
      : from
        ? `${format(from, "MMM d")} – …`
        : translate("calendar.any_date");

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button type="button" style={triggerStyle} onClick={toggleOpen}>
        <CalendarDays size={14} color="#00806E" aria-hidden="true" />
        {label}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 30,
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #eef0f3",
            boxShadow: "0 8px 24px rgba(11,30,61,0.12)",
            padding: 16,
            width: 300,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setMonth((m) => subMonths(m, 1))}
              aria-label="Previous month"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                display: "flex",
              }}
            >
              <ChevronLeft size={16} color="#5A6A7A" aria-hidden="true" />
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0B1E3D" }}>
              {format(month, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                display: "flex",
              }}
            >
              <ChevronRight size={16} color="#5A6A7A" aria-hidden="true" />
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 2,
              marginBottom: 4,
            }}
          >
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#9aa7b4",
                  textAlign: "center",
                  padding: "4px 0",
                }}
              >
                {d}
              </span>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 2,
            }}
          >
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {days.map((day) => {
              const isStart = draftFrom && isSameDay(day, draftFrom);
              const isEnd = draftTo && isSameDay(day, draftTo);
              const inRange =
                draftFrom &&
                draftTo &&
                isWithinInterval(day, { start: draftFrom, end: draftTo });
              const isEdge = isStart || isEnd;
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => pickDay(day)}
                  style={{
                    border: "none",
                    borderRadius: 8,
                    padding: "7px 0",
                    fontSize: 12,
                    fontWeight: isEdge ? 800 : 500,
                    cursor: "pointer",
                    background: isEdge
                      ? "#0B1E3D"
                      : inRange
                        ? "#E6F8F5"
                        : "transparent",
                    color: isEdge ? "#fff" : "#0B1E3D",
                  }}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid #f4f6f8",
            }}
          >
            <button
              type="button"
              onClick={clearRange}
              style={{
                background: "none",
                border: "none",
                color: "#9aa7b4",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={!draftFrom}
              style={{
                background: "#00C2A8",
                border: "none",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                borderRadius: 8,
                padding: "8px 16px",
                cursor: draftFrom ? "pointer" : "not-allowed",
                opacity: draftFrom ? 1 : 0.5,
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
