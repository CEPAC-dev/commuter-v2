"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import { useClientLocale } from "@/lib/i18n/client";
import type { TripPoint } from "@/lib/store/useTripStore";
import type { SavedAddress } from "@/components/map/LocationPickerMapOsm";

const LocationPickerMap = dynamic(
  () => import("@/components/map/LocationPickerMapOsm"),
  { ssr: false },
);

type Day = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

type AvailabilityRecord = {
  _id: string;
  dayOfWeek: Day;
  origin: TripPoint;
  destination?: TripPoint | null;
  startNearestStation?: { id: number; lat: number; lng: number; name: string } | null;
  startTime: string;
  endTime: string;
  active: boolean;
};

const DAYS: { id: Day }[] = [
  { id: "sun" },
  { id: "mon" },
  { id: "tue" },
  { id: "wed" },
  { id: "thu" },
  { id: "fri" },
  { id: "sat" },
];

type EditingShift = {
  id: string | null; // null = new shift
  days: Day[];
  origin: TripPoint | null;
  destination: TripPoint | null;
  startTime: string;
  endTime: string;
};

function timeToMinutes(val: string): number {
  const [h, m] = val.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function checkOverlap(
  startTime: string,
  endTime: string,
  existing: { startTime: string; endTime: string }[],
): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return existing.some(
    (item) => start < timeToMinutes(item.endTime) && end > timeToMinutes(item.startTime),
  );
}

function formatAvailabilityTime(locale: "en" | "ar", value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const hour = hours % 12 || 12;
  const period = hours >= 12
    ? locale === "ar" ? "مساء" : "PM"
    : locale === "ar" ? "صباحا" : "AM";
  return `${hour}:${String(minutes).padStart(2, "0")} ${period}`;
}

export default function AvailabilityClient({
  email,
  initialRecords,
  savedAddresses = [],
}: {
  email: string;
  initialRecords: AvailabilityRecord[];
  verificationStatus: string;
  savedAddresses?: SavedAddress[];
}) {
  const { t, locale, dir } = useClientLocale();
  const displayTime = (value: string) => formatAvailabilityTime(locale, value);
  function localizedText(
    key: string,
    params: Record<string, string | number> = {},
  ): string {
    const markers = Object.fromEntries(
      Object.keys(params).map((name) => [name, `__${name}__`]),
    );
    let result = t(key, markers);
    for (const [name, value] of Object.entries(params)) {
      result = result.replaceAll(`__${name}__`, String(value));
    }
    return result;
  }
  const dayLabel = (day: Day) => t(`availability.days.${day}`);
  const dayShortLabel = (day: Day) => t(`availability.days.${day}_short`);
  const [records, setRecords] = useState<AvailabilityRecord[]>(initialRecords);
  const [editing, setEditing] = useState<EditingShift | null>(null);
  const [activeFilterDay, setActiveFilterDay] = useState<Day | "all">("all");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<AvailabilityRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [error, setError] = useState("");
  const [availableSavedAddresses, setAvailableSavedAddresses] = useState(savedAddresses);

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [error]);

  function handleAddressSaved(saved: SavedAddress) {
    setAvailableSavedAddresses((current) =>
      current.some((place) => place._id === saved._id) ? current : [...current, saved],
    );
  }

  function beginAdd(initialDay?: Day) {
    setEditing({
      id: null,
      days: initialDay ? [initialDay] : ["sun", "mon", "tue", "wed", "thu"],
      origin: null,
      destination: null,
      startTime: "08:00",
      endTime: "16:00",
    });
    setError("");
  }

  function beginEdit(record: AvailabilityRecord) {
    setEditing({
      id: record._id,
      days: [record.dayOfWeek],
      origin: record.origin,
      destination: record.destination ?? null,
      startTime: record.startTime,
      endTime: record.endTime,
    });
    setError("");
  }

  async function saveShift() {
    if (!editing) return;
    if (!editing.origin) {
      setError(t("availability.error.origin_required"));
      return;
    }
    if (!editing.destination) {
      setError(t("availability.error.destination_required"));
      return;
    }
    if (editing.days.length === 0) {
      setError(t("availability.error.days_required"));
      return;
    }

    // Client-side overlap check across all selected days
    for (const day of editing.days) {
      const existingShifts = records.filter(
        (r) => r.dayOfWeek === day && r._id !== editing.id,
      );
      if (checkOverlap(editing.startTime, editing.endTime, existingShifts)) {
        setError(
          localizedText("availability.error.overlap", {
            day: dayLabel(day),
            start: displayTime(editing.startTime),
            end: displayTime(editing.endTime),
          }),
        );
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/driver/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          days: editing.days,
          origin: editing.origin,
          destination: editing.destination,
          startTime: editing.startTime,
          endTime: editing.endTime,
          active: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t("availability.error.save_failed"));

      const updatedOrCreated: AvailabilityRecord[] = data.records ?? [data.record];
      const updatedIds = new Set(updatedOrCreated.map((r) => r._id));

      setRecords((current) => [
        ...current.filter((item) => !updatedIds.has(item._id)),
        ...updatedOrCreated,
      ]);
      setEditing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("availability.error.save_failed"));
    } finally {
      setSaving(false);
    }
  }

  async function removeShift(record: AvailabilityRecord) {
    setDeleting(record._id);
    setConfirmingDelete(null);
    setError("");
    try {
      const response = await fetch(`/api/driver/availability/${record._id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? t("availability.error.delete_failed"));
      }
      setRecords((current) => current.filter((item) => item._id !== record._id));
      setSelectedIds((current) => current.filter((id) => id !== record._id));
      if (editing?.id === record._id) setEditing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("availability.error.delete_failed"));
    } finally {
      setDeleting(null);
    }
  }

  const filteredRecords = useMemo(() => {
    if (activeFilterDay === "all") return records;
    return records.filter((r) => r.dayOfWeek === activeFilterDay);
  }, [records, activeFilterDay]);

  // Sort records by day of week index and startTime
  const sortedRecords = useMemo(() => {
    const dayOrder: Record<Day, number> = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };
    return [...filteredRecords].sort((a, b) => {
      if (dayOrder[a.dayOfWeek] !== dayOrder[b.dayOfWeek]) {
        return dayOrder[a.dayOfWeek] - dayOrder[b.dayOfWeek];
      }
      return a.startTime.localeCompare(b.startTime);
    });
  }, [filteredRecords]);

  const allFilteredSelected =
    sortedRecords.length > 0 && sortedRecords.every((record) => selectedIds.includes(record._id));

  function toggleShiftSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleSelectAll() {
    const filteredIds = sortedRecords.map((record) => record._id);
    setSelectedIds((current) =>
      allFilteredSelected
        ? current.filter((id) => !filteredIds.includes(id))
        : [...new Set([...current, ...filteredIds])],
    );
  }

  async function removeSelectedShifts() {
    if (selectedIds.length === 0) return;
    if (!window.confirm(t("availability.bulk_delete_confirm", { count: selectedIds.length }))) return;

    setBulkDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/driver/availability", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t("availability.error.bulk_delete_failed"));
      const removed = new Set(selectedIds);
      setRecords((current) => current.filter((record) => !removed.has(record._id)));
      setSelectedIds([]);
      if (editing?.id && removed.has(editing.id)) setEditing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("availability.error.bulk_delete_failed"));
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <>
      <AppHeader email={email} authed role="driver" />
      <main
        dir={dir}
        style={{ fontFamily: locale === "ar" ? "var(--font-ar)" : "var(--font-en)" }}
        className="min-h-screen bg-[#f7faf9] px-4 pb-28 pt-8 text-[#0B1E3D] sm:px-6"
      >
        <div className="mx-auto max-w-4xl">
          {/* Hero Header Banner */}
          <div
            dir={dir}
            className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-[#0B1E3D] to-[#163666] p-6 text-white shadow-xl sm:p-8"
          >
            <div className="text-right">
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                {t("availability.title")}
              </h1>
              <p className="mt-2 max-w-xl text-sm font-medium text-[#a0b4d0]">
                {t("availability.description")}
              </p>
            </div>
            {!editing && (
              <button
                type="button"
                onClick={() => beginAdd()}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#00c2a8] px-5 py-3 text-sm font-extrabold text-[#0B1E3D] shadow-lg transition-all hover:bg-[#00ab94] hover:scale-105 active:scale-95"
              >
                <Plus size={18} /> {t("availability.add_button")}
              </button>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="fixed inset-x-4 top-24 z-[70] mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-[#e74c3c]/30 bg-white p-4 text-sm font-semibold text-[#c0392b] shadow-[0_16px_40px_rgba(231,76,60,0.2)] sm:inset-x-auto sm:right-6 sm:w-[min(28rem,calc(100vw-3rem))]"
            >
              <span className="mt-0.5 flex-1">{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                aria-label={t("availability.close")}
                className="shrink-0 rounded-lg p-1 text-[#c0392b] hover:bg-[#fff0ee]"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {confirmingDelete && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-[#07152b]/60 p-4 backdrop-blur-sm"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setConfirmingDelete(null);
              }}
            >
              <div
                className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-[0_24px_80px_rgba(7,21,43,0.28)]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-availability-title"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff0ee] text-[#e74c3c]">
                      <Trash2 size={21} />
                    </div>
                    <h2 id="delete-availability-title" className="text-xl font-black text-[#0B1E3D]">
                      {t("availability.delete_title")}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#5A6A7A]">
                      {localizedText("availability.delete_description", {
                        day: dayLabel(confirmingDelete.dayOfWeek),
                        start: displayTime(confirmingDelete.startTime),
                        end: displayTime(confirmingDelete.endTime),
                      })} {t("availability.delete_irreversible")}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={t("availability.close")}
                    onClick={() => setConfirmingDelete(null)}
                    className="rounded-xl p-2 text-[#5A6A7A] hover:bg-[#f0f4f8] hover:text-[#0B1E3D]"
                  >
                    <X size={19} />
                  </button>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(null)}
                    className="rounded-xl px-4 py-2.5 text-sm font-extrabold text-[#5A6A7A] hover:bg-[#f0f4f8]"
                  >
                    {t("availability.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeShift(confirmingDelete)}
                    disabled={deleting === confirmingDelete._id}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#e74c3c] px-4 py-2.5 text-sm font-extrabold text-white hover:bg-[#c0392b] disabled:opacity-50"
                  >
                    {deleting === confirmingDelete._id ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
                    {t("availability.delete_shift")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* New / Edit Shift Form Section */}
          {editing && (
            <section className="mb-8 rounded-3xl border-2 border-[#00c2a8] bg-white p-6 shadow-[0_12px_36px_rgba(0,194,168,0.15)] sm:p-7">
              <div className="flex items-center justify-between border-b border-[#edf1f4] pb-4 mb-5">
                <h2 className="text-lg font-extrabold text-[#0B1E3D] flex items-center gap-2">
                  <CalendarDays size={20} className="text-[#00c2a8]" />
                  {editing.id ? t("availability.edit_title") : t("availability.create_title")}
                </h2>
                <span className="text-xs font-semibold text-[#5A6A7A]">
                  {editing.id ? t("availability.editing_single") : t("availability.select_target_days")}
                </span>
              </div>

              {/* Multi-Day Selection Chips */}
              <div className="mb-6">
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-[#5A6A7A]">
                  {t("availability.days_label")} {editing.id !== null && `(${t("availability.fixed")})`}
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => {
                    const isSelected = editing.days.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          if (editing.id !== null) return;
                          const nextDays = isSelected
                            ? editing.days.filter((x) => x !== d.id)
                            : [...editing.days, d.id];
                          setEditing({ ...editing, days: nextDays });
                        }}
                        disabled={editing.id !== null}
                        className={`rounded-2xl px-4 py-2.5 text-xs font-black transition-all ${
                          isSelected
                            ? "bg-[#00c2a8] text-[#0B1E3D] shadow-md scale-105"
                            : "bg-[#f0f4f8] text-[#5A6A7A] hover:bg-[#e2e8f0]"
                        } ${editing.id !== null ? "opacity-75 cursor-not-allowed" : ""}`}
                      >
                        {dayLabel(d.id)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-[#5A6A7A]">
                    {t("availability.start_location")}
                  </label>
                  <LocationPickerMap
                    lat={editing.origin ? String(editing.origin.lat) : ""}
                    lng={editing.origin ? String(editing.origin.lng) : ""}
                    name={editing.origin?.address ?? ""}
                    savedAddresses={availableSavedAddresses}
                    onSaved={handleAddressSaved}
                    onChange={(lat, lng, name) =>
                      setEditing((current) =>
                        current
                          ? {
                              ...current,
                              origin:
                                lat && lng
                                  ? { address: name, lat: Number(lat), lng: Number(lng) }
                                  : null,
                            }
                          : current,
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-[#5A6A7A]">
                    {t("availability.end_location")}
                  </label>
                  <LocationPickerMap
                    lat={editing.destination ? String(editing.destination.lat) : ""}
                    lng={editing.destination ? String(editing.destination.lng) : ""}
                    name={editing.destination?.address ?? ""}
                    savedAddresses={availableSavedAddresses}
                    onSaved={handleAddressSaved}
                    onChange={(lat, lng, name) =>
                      setEditing((current) =>
                        current
                          ? {
                              ...current,
                              destination:
                                lat && lng
                                  ? { address: name, lat: Number(lat), lng: Number(lng) }
                                  : null,
                            }
                          : current,
                      )
                    }
                  />
                </div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-[#5A6A7A]">
                  {t("availability.from_start")}
                  <input
                    type="time"
                    lang={locale}
                    value={editing.startTime}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, startTime: event.target.value } : current,
                      )
                    }
                    style={{ direction: "ltr", textAlign: "left" }}
                    className="mt-2 h-12 w-full rounded-2xl border border-[#e2e8f0] px-3.5 font-mono text-sm font-bold text-[#0B1E3D] focus:border-[#00c2a8] focus:outline-none"
                  />
                </label>
                <label className="text-xs font-extrabold uppercase tracking-wider text-[#5A6A7A]">
                  {t("availability.to_end")}
                  <input
                    type="time"
                    lang={locale}
                    value={editing.endTime}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, endTime: event.target.value } : current,
                      )
                    }
                    style={{ direction: "ltr", textAlign: "left" }}
                    className="mt-2 h-12 w-full rounded-2xl border border-[#e2e8f0] px-3.5 font-mono text-sm font-bold text-[#0B1E3D] focus:border-[#00c2a8] focus:outline-none"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[#edf1f4] pt-5">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-2xl px-5 py-3 text-sm font-extrabold text-[#5A6A7A] hover:bg-[#edf1f4]"
                >
                  {t("availability.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => void saveShift()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#00c2a8] px-6 py-3 text-sm font-black text-[#0B1E3D] shadow-lg hover:bg-[#00ab94] disabled:opacity-50"
                >
                  <Save size={16} /> {saving ? t("availability.saving") : t("availability.save")}
                </button>
              </div>
            </section>
          )}

          {/* Filter Bar & Schedule Count Header */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-1.5 rounded-2xl border border-[#e2e8f0] bg-white p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveFilterDay("all")}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                  activeFilterDay === "all"
                    ? "bg-[#00c2a8] text-[#0B1E3D] shadow-xs"
                    : "text-[#5A6A7A] hover:text-[#0B1E3D]"
                }`}
              >
                {t("availability.all_days")} ({records.length})
              </button>
              {DAYS.map((d) => {
                const count = records.filter((r) => r.dayOfWeek === d.id).length;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setActiveFilterDay(d.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all ${
                      activeFilterDay === d.id
                        ? "bg-[#00c2a8] text-[#0B1E3D] shadow-xs"
                        : "text-[#5A6A7A] hover:text-[#0B1E3D]"
                    }`}
                  >
                    {dayShortLabel(d.id)} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {sortedRecords.length > 0 ? (
                <button type="button" onClick={toggleSelectAll} className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-extrabold text-[#0B1E3D] hover:bg-[#f0f4f8]">
                  {allFilteredSelected ? t("availability.clear_selection") : t("availability.select_all")}
                </button>
              ) : null}
              {selectedIds.length > 0 ? (
                <button type="button" onClick={() => void removeSelectedShifts()} disabled={bulkDeleting} className="inline-flex items-center gap-1.5 rounded-xl bg-[#e74c3c] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[#c0392b] disabled:opacity-50">
                  {bulkDeleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                  {t("availability.delete_selected")} ({selectedIds.length})
                </button>
              ) : null}
              <span className="text-xs font-bold text-[#5A6A7A]">
                {localizedText(
                  sortedRecords.length === 1
                    ? "availability.schedule_count_one"
                    : "availability.schedule_count_many",
                  { count: sortedRecords.length },
                )}
              </span>
            </div>
          </div>

          {/* Schedule List / Empty State */}
          {sortedRecords.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#cbd5e1] bg-white p-12 text-center shadow-xs">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#effaf8] text-[#00c2a8]">
                <Clock size={32} />
              </div>
              <h3 className="text-lg font-black text-[#0B1E3D]">
                {t("availability.empty_title")}
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[#5A6A7A]">
                {activeFilterDay === "all"
                  ? t("availability.empty_description")
                  : localizedText("availability.no_day_schedule", { day: dayLabel(activeFilterDay) })}
              </p>
              {!editing && (
                <button
                  type="button"
                  onClick={() => beginAdd(activeFilterDay === "all" ? undefined : activeFilterDay)}
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#00c2a8] px-5 py-3 text-sm font-extrabold text-[#0B1E3D] shadow-md hover:bg-[#00ab94]"
                >
                  <Plus size={16} /> {localizedText("availability.add_schedule_for", {
                    day: activeFilterDay === "all" ? t("availability.week") : dayLabel(activeFilterDay),
                  })}
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {sortedRecords.map((shift) => {
                const isEditingThis = editing?.id === shift._id;
                const isSelected = selectedIds.includes(shift._id);
                return (
                  <div
                    key={shift._id}
                    className={`group relative rounded-2xl border p-5 transition-all bg-white shadow-sm hover:shadow-md ${
                      isEditingThis || isSelected ? "border-[#00c2a8] ring-2 ring-[#00c2a8]/20" : "border-[#e2e8f0]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleShiftSelection(shift._id)}
                          aria-label={localizedText("availability.select_shift", {
                            day: dayLabel(shift.dayOfWeek),
                            start: displayTime(shift.startTime),
                          })}
                          className="h-4 w-4 accent-[#00c2a8]"
                        />
                        <span className="rounded-xl bg-[#0B1E3D] px-3 py-1.5 text-xs font-black uppercase text-white tracking-wider">
                          {dayLabel(shift.dayOfWeek)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                          <CheckCircle2 size={12} /> {t("availability.active")}
                        </span>
                      </div>

                      {!isEditingThis && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => beginEdit(shift)}
                            className="rounded-xl px-3 py-1.5 text-xs font-extrabold text-[#00a990] hover:bg-[#effaf8] transition-colors"
                          >
                            {t("availability.edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDelete(shift)}
                            disabled={deleting === shift._id}
                            className="rounded-xl p-2 text-[#e74c3c] hover:bg-[#fff0ee] disabled:opacity-50 transition-colors"
                          >
                            {deleting === shift._id ? (
                              <Loader2 className="animate-spin" size={15} />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-extrabold text-[#0B1E3D]">
                        <Clock size={16} className="text-[#00c2a8] shrink-0" />
                        <span
                          className="font-mono bg-[#f0f4f8] px-2.5 py-1 rounded-lg"
                          style={{ direction: "ltr", unicodeBidi: "isolate" }}
                        >
                          {localizedText("availability.time_range", {
                            start: displayTime(shift.startTime),
                            end: displayTime(shift.endTime),
                          })}
                        </span>
                      </div>

                      <div className="flex items-start gap-2 text-xs text-[#5A6A7A]">
                        <MapPin size={15} className="text-[#0B1E3D] shrink-0 mt-0.5" />
                        <span className="font-medium line-clamp-2" title={shift.origin.address}>
                          {shift.origin.address}
                        </span>
                      </div>
                      {shift.destination && (
                        <div className="flex items-start gap-2 text-xs text-[#5A6A7A]">
                          <MapPin size={15} className="text-[#F5A623] shrink-0 mt-0.5" />
                          <span className="font-medium line-clamp-2" title={shift.destination.address}>
                            {shift.destination.address}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
