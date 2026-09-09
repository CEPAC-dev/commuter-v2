"use client";

import { useState, useMemo } from "react";
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
  Zap,
} from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
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
  startNearestStation?: { id: number; lat: number; lng: number; name: string } | null;
  startTime: string;
  endTime: string;
  active: boolean;
};

const DAYS: { id: Day; label: string; short: string }[] = [
  { id: "sun", label: "Sunday", short: "Sun" },
  { id: "mon", label: "Monday", short: "Mon" },
  { id: "tue", label: "Tuesday", short: "Tue" },
  { id: "wed", label: "Wednesday", short: "Wed" },
  { id: "thu", label: "Thursday", short: "Thu" },
  { id: "fri", label: "Friday", short: "Fri" },
  { id: "sat", label: "Saturday", short: "Sat" },
];

const DAY_LABELS: Record<Day, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

type EditingShift = {
  id: string | null; // null = new shift
  days: Day[];
  origin: TripPoint | null;
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
  const [records, setRecords] = useState<AvailabilityRecord[]>(initialRecords);
  const [editing, setEditing] = useState<EditingShift | null>(null);
  const [activeFilterDay, setActiveFilterDay] = useState<Day | "all">("all");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [error, setError] = useState("");

  function beginAdd(initialDay?: Day) {
    setEditing({
      id: null,
      days: initialDay ? [initialDay] : ["sun", "mon", "tue", "wed", "thu"],
      origin: null,
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
      startTime: record.startTime,
      endTime: record.endTime,
    });
    setError("");
  }

  async function saveShift() {
    if (!editing) return;
    if (!editing.origin) {
      setError("Choose your starting location.");
      return;
    }
    if (editing.days.length === 0) {
      setError("Select at least one day for your working hours.");
      return;
    }

    // Client-side overlap check across all selected days
    for (const day of editing.days) {
      const existingShifts = records.filter(
        (r) => r.dayOfWeek === day && r._id !== editing.id,
      );
      if (checkOverlap(editing.startTime, editing.endTime, existingShifts)) {
        setError(
          `Overlaps with existing availability on ${DAY_LABELS[day]} (${editing.startTime}–${editing.endTime}).`,
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
          startTime: editing.startTime,
          endTime: editing.endTime,
          active: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save shift.");

      const updatedOrCreated: AvailabilityRecord[] = data.records ?? [data.record];
      const updatedIds = new Set(updatedOrCreated.map((r) => r._id));

      setRecords((current) => [
        ...current.filter((item) => !updatedIds.has(item._id)),
        ...updatedOrCreated,
      ]);
      setEditing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save shift.");
    } finally {
      setSaving(false);
    }
  }

  async function removeShift(record: AvailabilityRecord) {
    setDeleting(record._id);
    setError("");
    try {
      const response = await fetch(`/api/driver/availability/${record._id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Could not remove shift.");
      }
      setRecords((current) => current.filter((item) => item._id !== record._id));
      setSelectedIds((current) => current.filter((id) => id !== record._id));
      if (editing?.id === record._id) setEditing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove shift.");
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
    if (!window.confirm(`Delete ${selectedIds.length} selected availability shift${selectedIds.length === 1 ? "" : "s"}?`)) return;

    setBulkDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/driver/availability", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not remove selected shifts.");
      const removed = new Set(selectedIds);
      setRecords((current) => current.filter((record) => !removed.has(record._id)));
      setSelectedIds([]);
      if (editing?.id && removed.has(editing.id)) setEditing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove selected shifts.");
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <>
      <AppHeader email={email} authed role="driver" />
      <main className="min-h-screen bg-[#f7faf9] px-4 pb-28 pt-8 text-[#0B1E3D] sm:px-6">
        <div className="mx-auto max-w-4xl">
          {/* Hero Header Banner */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-[#0B1E3D] to-[#163666] p-6 text-white shadow-xl sm:p-8">
            <div>
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#00c2a8]/20 px-3 py-1 text-xs font-bold text-[#00c2a8]">
                <Zap size={14} /> Recurring Driver Work Hours
              </span>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                My Availability
              </h1>
              <p className="mt-2 max-w-xl text-sm font-medium text-[#a0b4d0]">
                Choose working hours across multiple days. Drivers cannot set overlapping hours on the same day.
              </p>
            </div>
            {!editing && (
              <button
                type="button"
                onClick={() => beginAdd()}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#00c2a8] px-5 py-3 text-sm font-extrabold text-[#0B1E3D] shadow-lg transition-all hover:bg-[#00ab94] hover:scale-105 active:scale-95"
              >
                <Plus size={18} /> Add Availability
              </button>
            )}
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-[#e74c3c] bg-[#ffebee] p-4 text-sm font-semibold text-[#c0392b] shadow-sm">
              {error}
            </div>
          )}

          {/* New / Edit Shift Form Section */}
          {editing && (
            <section className="mb-8 rounded-3xl border-2 border-[#00c2a8] bg-white p-6 shadow-[0_12px_36px_rgba(0,194,168,0.15)] sm:p-7">
              <div className="flex items-center justify-between border-b border-[#edf1f4] pb-4 mb-5">
                <h2 className="text-lg font-extrabold text-[#0B1E3D] flex items-center gap-2">
                  <CalendarDays size={20} className="text-[#00c2a8]" />
                  {editing.id ? "Edit Availability Schedule" : "Create New Availability"}
                </h2>
                <span className="text-xs font-semibold text-[#5A6A7A]">
                  {editing.id ? "Editing single shift" : "Select target days"}
                </span>
              </div>

              {/* Multi-Day Selection Chips */}
              <div className="mb-6">
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-[#5A6A7A]">
                  Select Days of Week {editing.id !== null && "(Fixed)"}
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
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_140px_140px]">
                <div>
                  <label className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-[#5A6A7A]">
                    Starting Location
                  </label>
                  <LocationPickerMap
                    lat={editing.origin ? String(editing.origin.lat) : ""}
                    lng={editing.origin ? String(editing.origin.lng) : ""}
                    name={editing.origin?.address ?? ""}
                    savedAddresses={savedAddresses}
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
                <label className="text-xs font-extrabold uppercase tracking-wider text-[#5A6A7A]">
                  From (Start)
                  <input
                    type="time"
                    value={editing.startTime}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, startTime: event.target.value } : current,
                      )
                    }
                    className="mt-2 h-12 w-full rounded-2xl border border-[#e2e8f0] px-3.5 font-mono text-sm font-bold text-[#0B1E3D] focus:border-[#00c2a8] focus:outline-none"
                  />
                </label>
                <label className="text-xs font-extrabold uppercase tracking-wider text-[#5A6A7A]">
                  To (End)
                  <input
                    type="time"
                    value={editing.endTime}
                    onChange={(event) =>
                      setEditing((current) =>
                        current ? { ...current, endTime: event.target.value } : current,
                      )
                    }
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
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveShift()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#00c2a8] px-6 py-3 text-sm font-black text-[#0B1E3D] shadow-lg hover:bg-[#00ab94] disabled:opacity-50"
                >
                  <Save size={16} /> {saving ? "Saving..." : "Save Availability"}
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
                All Days ({records.length})
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
                    {d.short} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {sortedRecords.length > 0 ? (
                <button type="button" onClick={toggleSelectAll} className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-extrabold text-[#0B1E3D] hover:bg-[#f0f4f8]">
                  {allFilteredSelected ? "Clear selection" : "Select all"}
                </button>
              ) : null}
              {selectedIds.length > 0 ? (
                <button type="button" onClick={() => void removeSelectedShifts()} disabled={bulkDeleting} className="inline-flex items-center gap-1.5 rounded-xl bg-[#e74c3c] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[#c0392b] disabled:opacity-50">
                  {bulkDeleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                  Delete selected ({selectedIds.length})
                </button>
              ) : null}
              <span className="text-xs font-bold text-[#5A6A7A]">
                {sortedRecords.length} active schedule{sortedRecords.length === 1 ? "" : "s"}
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
                No Availability Schedules Found
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[#5A6A7A]">
                {activeFilterDay === "all"
                  ? "You haven't set any working hours yet. Add your availability to start accepting ride requests."
                  : `No availability set for ${DAY_LABELS[activeFilterDay]}.`}
              </p>
              {!editing && (
                <button
                  type="button"
                  onClick={() => beginAdd(activeFilterDay === "all" ? undefined : activeFilterDay)}
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#00c2a8] px-5 py-3 text-sm font-extrabold text-[#0B1E3D] shadow-md hover:bg-[#00ab94]"
                >
                  <Plus size={16} /> Add Schedule for {activeFilterDay === "all" ? "Week" : DAY_LABELS[activeFilterDay]}
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
                          aria-label={`Select ${DAY_LABELS[shift.dayOfWeek]} ${shift.startTime} shift`}
                          className="h-4 w-4 accent-[#00c2a8]"
                        />
                        <span className="rounded-xl bg-[#0B1E3D] px-3 py-1.5 text-xs font-black uppercase text-white tracking-wider">
                          {DAY_LABELS[shift.dayOfWeek]}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      </div>

                      {!isEditingThis && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => beginEdit(shift)}
                            className="rounded-xl px-3 py-1.5 text-xs font-extrabold text-[#00a990] hover:bg-[#effaf8] transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeShift(shift)}
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
                        <span className="font-mono bg-[#f0f4f8] px-2.5 py-1 rounded-lg">
                          from: {shift.startTime} to: {shift.endTime}
                        </span>
                      </div>

                      <div className="flex items-start gap-2 text-xs text-[#5A6A7A]">
                        <MapPin size={15} className="text-[#0B1E3D] shrink-0 mt-0.5" />
                        <span className="font-medium line-clamp-2" title={shift.origin.address}>
                          {shift.origin.address}
                        </span>
                      </div>
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
