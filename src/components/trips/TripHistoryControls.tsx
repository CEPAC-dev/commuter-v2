"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useClientLocale } from "@/lib/locale.client";
import { getCairoNowParts } from "@/lib/time/cairoTime";

type Preset = "7days" | "30days" | "month" | "custom";

function addDays(dateString: string, amount: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function detectPreset(from: string, to: string, today: string): Preset {
  if (!from && !to) return "custom";
  if (to !== today) return "custom";
  if (from === addDays(today, -6)) return "7days";
  if (from === addDays(today, -29)) return "30days";
  if (from === `${today.slice(0, 7)}-01`) return "month";
  return "custom";
}

export default function TripHistoryControls() {
  const { t } = useClientLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const today = getCairoNowParts().dateStr;
  const [preset, setPreset] = useState<Preset>(() => detectPreset(from, to, today));

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    setFrom(searchParams.get("from") ?? "");
    setTo(searchParams.get("to") ?? "");
    setPreset(detectPreset(searchParams.get("from") ?? "", searchParams.get("to") ?? "", today));
  }, [searchParams, today]);

  useEffect(() => {
    const value = query.trim();
    if (value === (searchParams.get("q") ?? "")) return;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      params.delete("page");
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [query, pathname, router, searchParams]);

  function updateRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    const params = new URLSearchParams(searchParams.toString());
    if (nextFrom) params.set("from", nextFrom);
    else params.delete("from");
    if (nextTo) params.set("to", nextTo);
    else params.delete("to");
    params.delete("page");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  function selectPreset(value: Preset) {
    setPreset(value);
    if (value === "7days") updateRange(addDays(today, -6), today);
    if (value === "30days") updateRange(addDays(today, -29), today);
    if (value === "month") updateRange(`${today.slice(0, 7)}-01`, today);
  }

  function clearAll() {
    setQuery("");
    setFrom("");
    setTo("");
    setPreset("custom");
    router.replace(pathname, { scroll: false });
  }

  const activeStatus = searchParams.get("status");
  const hasFilters = Boolean(query.trim() || from || to || (activeStatus && activeStatus !== "all"));
  const chipStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 9px",
    borderRadius: 16,
    background: "#EAF3F0",
    color: "#24574E",
    fontSize: 11,
    fontWeight: 700,
  } as const;

  return (
    <section aria-label={t("history.search_filters")} style={{ display: "grid", gap: 12, margin: "16px 0" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 44, padding: "0 12px", border: "1px solid #C9DCD6", borderRadius: 6, background: "#fff", color: "#526262" }}>
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          inputMode="numeric"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("history.search_trip_number")}
          aria-label={t("history.search_trip_number")}
          style={{ width: "100%", minWidth: 0, border: 0, outline: 0, background: "transparent", color: "#173337", font: "inherit", fontSize: 13 }}
        />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <label style={{ display: "grid", gap: 4, color: "#526262", fontSize: 11, fontWeight: 700 }}>
          {t("history.from")}
          <input type="date" value={from} onChange={(event) => updateRange(event.target.value, to)} aria-label={t("history.from")} style={{ minHeight: 40, minWidth: 0, padding: "0 9px", border: "1px solid #C9DCD6", borderRadius: 5, background: "#fff", color: "#173337", font: "inherit" }} />
        </label>
        <label style={{ display: "grid", gap: 4, color: "#526262", fontSize: 11, fontWeight: 700 }}>
          {t("history.to")}
          <input type="date" value={to} onChange={(event) => updateRange(from, event.target.value)} aria-label={t("history.to")} style={{ minHeight: 40, minWidth: 0, padding: "0 9px", border: "1px solid #C9DCD6", borderRadius: 5, background: "#fff", color: "#173337", font: "inherit" }} />
        </label>
      </div>

      <div role="group" aria-label={t("history.date_presets")} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {(["7days", "30days", "month", "custom"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={preset === value}
            onClick={() => selectPreset(value)}
            style={{ minHeight: 34, padding: "0 10px", border: `1px solid ${preset === value ? "#007A6A" : "#DCE6E4"}`, borderRadius: 5, background: preset === value ? "#EAF3F0" : "#fff", color: preset === value ? "#00594F" : "#526262", font: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            {t(`history.preset_${value}`)}
          </button>
        ))}
      </div>

      {hasFilters && (
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }} aria-label={t("history.active_filters")}>
          {query.trim() && <span style={chipStyle}>{t("history.trip_number_chip", { number: query.trim() })}</span>}
          {(from || to) && <span style={chipStyle}>{from || "…"} – {to || "…"}</span>}
          {activeStatus && activeStatus !== "all" && <span style={chipStyle}>{t(`history.filter_${activeStatus}`)}</span>}
          <button type="button" onClick={clearAll} style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32, padding: "0 7px", border: 0, background: "transparent", color: "#8F2D28", font: "inherit", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
            <X size={13} aria-hidden="true" /> {t("history.clear_all")}
          </button>
        </div>
      )}
    </section>
  );
}