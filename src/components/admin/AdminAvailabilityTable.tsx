"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Calendar,
  Check,
  Clock,
  Minus,
  Search,
  TrendingUp,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { AdminCard } from "@/components/admin/layout";

type Day = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

type RecordItem = {
  _id: string;
  dayOfWeek: Day;
  origin: { address: string };
  startTime: string;
  endTime: string;
  active: boolean;
};

type DriverRow = {
  id: string;
  name: string;
  phone: string;
  userNumber?: number;
  records: RecordItem[];
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

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isShiftActiveInHour(
  startTime: string,
  endTime: string,
  hour: number,
): boolean {
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const hourStart = hour * 60;
  const hourEnd = (hour + 1) * 60;
  return startMins < hourEnd && endMins > hourStart;
}

function formatHour(h: number): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(h)}:00`;
}

export default function AdminAvailabilityTable({
  initialRecords,
}: {
  initialRecords: DriverRow[];
}) {
  const [selectedDay, setSelectedDay] = useState<Day | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [modalDay, setModalDay] = useState<Day | null>(null);

  // 1. Overall & Per-Day Unique Drivers Analytics
  const overallAvailableCount = useMemo(() => {
    return initialRecords.filter((d) => d.records.some((r) => r.active)).length;
  }, [initialRecords]);

  const perDayDriverCounts = useMemo(() => {
    const counts: Record<Day, number> = {
      sun: 0,
      mon: 0,
      tue: 0,
      wed: 0,
      thu: 0,
      fri: 0,
      sat: 0,
    };
    for (const day of DAYS) {
      counts[day.id] = initialRecords.filter((driver) =>
        driver.records.some((r) => r.dayOfWeek === day.id && r.active),
      ).length;
    }
    return counts;
  }, [initialRecords]);

  // 2. Hourly Graph Data (00:00 to 23:00) for selectedDay
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => h);
    return hours.map((hour) => {
      const activeDriverIds = new Set<string>();
      for (const driver of initialRecords) {
        const matchesDay = driver.records.filter((r) => {
          if (!r.active) return false;
          if (selectedDay !== "all" && r.dayOfWeek !== selectedDay) return false;
          return isShiftActiveInHour(r.startTime, r.endTime, hour);
        });
        if (matchesDay.length > 0) {
          activeDriverIds.add(driver.id);
        }
      }
      return {
        hour,
        label: formatHour(hour),
        count: activeDriverIds.size,
      };
    });
  }, [initialRecords, selectedDay]);

  const maxHourlyCount = useMemo(() => {
    return Math.max(...hourlyData.map((d) => d.count), 1);
  }, [hourlyData]);

  // 3. Peak Hours per Day
  const peakHoursPerDay = useMemo(() => {
    const peaks: Record<
      Day,
      { maxDrivers: number; peakLabel: string; hours: number[] }
    > = {
      sun: { maxDrivers: 0, peakLabel: "None", hours: [] },
      mon: { maxDrivers: 0, peakLabel: "None", hours: [] },
      tue: { maxDrivers: 0, peakLabel: "None", hours: [] },
      wed: { maxDrivers: 0, peakLabel: "None", hours: [] },
      thu: { maxDrivers: 0, peakLabel: "None", hours: [] },
      fri: { maxDrivers: 0, peakLabel: "None", hours: [] },
      sat: { maxDrivers: 0, peakLabel: "None", hours: [] },
    };

    for (const day of DAYS) {
      const counts: number[] = Array.from({ length: 24 }, (_, hour) => {
        const driverIds = new Set<string>();
        for (const driver of initialRecords) {
          if (
            driver.records.some(
              (r) =>
                r.active &&
                r.dayOfWeek === day.id &&
                isShiftActiveInHour(r.startTime, r.endTime, hour),
            )
          ) {
            driverIds.add(driver.id);
          }
        }
        return driverIds.size;
      });

      const maxVal = Math.max(...counts, 0);
      if (maxVal > 0) {
        const peakHrs = counts
          .map((c, h) => (c === maxVal ? h : -1))
          .filter((h) => h !== -1);
        const ranges = peakHrs.map((h) => `${formatHour(h)}–${formatHour(h + 1)}`);
        peaks[day.id] = {
          maxDrivers: maxVal,
          peakLabel: ranges.join(", "),
          hours: peakHrs,
        };
      }
    }
    return peaks;
  }, [initialRecords]);

  const selectedPeakInfo = useMemo(() => {
    if (selectedDay === "all") {
      const maxVal = Math.max(...hourlyData.map((d) => d.count), 0);
      if (maxVal === 0) return { label: "No active shifts", count: 0 };
      const peakHrs = hourlyData
        .filter((d) => d.count === maxVal)
        .map((d) => `${d.label}–${formatHour(d.hour + 1)}`);
      return { label: peakHrs.join(", "), count: maxVal };
    }
    const peak = peakHoursPerDay[selectedDay];
    return { label: peak.peakLabel, count: peak.maxDrivers };
  }, [hourlyData, peakHoursPerDay, selectedDay]);

  // Drivers available for Modal Day
  const modalDayDrivers = useMemo(() => {
    if (!modalDay) return [];
    return initialRecords
      .map((driver) => {
        const dayShifts = driver.records.filter(
          (r) => r.dayOfWeek === modalDay && r.active,
        );
        if (dayShifts.length === 0) return null;
        return {
          driver,
          shifts: dayShifts,
        };
      })
      .filter((item): item is { driver: DriverRow; shifts: RecordItem[] } => item !== null);
  }, [initialRecords, modalDay]);

  // Driver Table Filtering (with #userNumber exact match support)
  const visibleRows = useMemo(() => {
    const query = searchQuery.trim();
    return initialRecords.filter((driver) => {
      // 1. Filter by selected day
      if (selectedDay !== "all") {
        const hasDayShift = driver.records.some(
          (r) => r.dayOfWeek === selectedDay && r.active,
        );
        if (!hasDayShift) return false;
      }

      // 2. Filter by search query
      if (query !== "") {
        if (query.startsWith("#")) {
          const targetNumberStr = query.slice(1).trim();
          const targetNumber = parseInt(targetNumberStr, 10);
          if (!isNaN(targetNumber)) {
            // Exact user number match
            if (driver.userNumber !== targetNumber) return false;
          }
        } else {
          // General search by name, phone, or user number string
          const qLower = query.toLowerCase();
          const nameMatch = driver.name.toLowerCase().includes(qLower);
          const phoneMatch = driver.phone.toLowerCase().includes(qLower);
          const numMatch = driver.userNumber ? String(driver.userNumber).includes(qLower) : false;
          if (!nameMatch && !phoneMatch && !numMatch) return false;
        }
      }

      return true;
    });
  }, [initialRecords, selectedDay, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminCard padding={16}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Overall Available Drivers
              </p>
              <h3 className="mt-1 text-2xl font-black text-[var(--color-primary)]">
                {overallAvailableCount}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00C2A8]/10 text-[#00C2A8]">
              <Users size={22} />
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Drivers with recurring weekly shifts
          </p>
        </AdminCard>

        <AdminCard padding={16}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Selected Day Drivers
              </p>
              <h3 className="mt-1 text-2xl font-black text-[#00C2A8]">
                {selectedDay === "all"
                  ? overallAvailableCount
                  : perDayDriverCounts[selectedDay]}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Calendar size={22} />
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Active on {selectedDay === "all" ? "All Days" : DAYS.find((d) => d.id === selectedDay)?.label}
          </p>
        </AdminCard>

        <AdminCard padding={16}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Peak Time Slot
              </p>
              <h3 className="mt-1 truncate text-lg font-extrabold text-[var(--color-primary)]">
                {selectedPeakInfo.count > 0 ? selectedPeakInfo.label : "None"}
              </h3>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F5A623]/10 text-[#F5A623]">
              <Zap size={22} />
            </div>
          </div>
          <p className="mt-2 text-xs font-semibold text-[#F5A623]">
            {selectedPeakInfo.count} max available driver{selectedPeakInfo.count === 1 ? "" : "s"}
          </p>
        </AdminCard>

        <AdminCard padding={16}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Active Shifts Total
              </p>
              <h3 className="mt-1 text-2xl font-black text-[var(--color-primary)]">
                {initialRecords.reduce(
                  (acc, d) => acc + d.records.filter((r) => r.active).length,
                  0,
                )}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <TrendingUp size={22} />
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Total active shifts scheduled
          </p>
        </AdminCard>
      </div>

      {/* Top Bar Day Selector & Hourly Analytics Section */}
      <AdminCard padding={20}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-[var(--color-primary)]">
              <BarChart3 size={20} className="text-[#00C2A8]" />
              Hourly Driver Availability Timeline
            </h2>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Select a day to inspect how many drivers are working in each 1-hour window.
            </p>
          </div>

          {/* Top Bar Day Selector Pills */}
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-1">
            <button
              type="button"
              onClick={() => setSelectedDay("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors ${selectedDay === "all"
                  ? "bg-[#00C2A8] text-[#0B1E3D] shadow-xs"
                  : "text-[var(--color-muted)] hover:text-[var(--color-primary)]"
                }`}
            >
              All Days
            </button>
            {DAYS.map((day) => (
              <button
                key={day.id}
                type="button"
                onClick={() => setSelectedDay(day.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors ${selectedDay === day.id
                    ? "bg-[#00C2A8] text-[#0B1E3D] shadow-xs"
                    : "text-[var(--color-muted)] hover:text-[var(--color-primary)]"
                  }`}
              >
                {day.short}
              </button>
            ))}
          </div>
        </div>

        {/* 24-Hour Graph Visual */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-[var(--color-muted)] mb-2 font-mono">
            <span>00:00 (Midnight)</span>
            <span>12:00 (Noon)</span>
            <span>23:00 (Night)</span>
          </div>

          <div className="grid h-48 grid-cols-24 items-end gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
            {hourlyData.map((slot) => {
              const heightPercent =
                maxHourlyCount > 0 ? (slot.count / maxHourlyCount) * 100 : 0;
              const isHovered = hoveredHour === slot.hour;
              const isPeak =
                selectedPeakInfo.count > 0 && slot.count === selectedPeakInfo.count;

              return (
                <div
                  key={slot.hour}
                  onMouseEnter={() => setHoveredHour(slot.hour)}
                  onMouseLeave={() => setHoveredHour(null)}
                  className="group relative flex h-full flex-col justify-end items-center"
                >
                  {/* Tooltip on Hover */}
                  {isHovered && (
                    <div className="absolute -top-10 z-30 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-2.5 py-1 text-[11px] font-bold text-white shadow-lg">
                      {slot.label}–{formatHour(slot.hour + 1)}: {slot.count} driver{slot.count === 1 ? "" : "s"}
                    </div>
                  )}

                  {/* Count Badge on Top of Bar */}
                  {slot.count > 0 && (
                    <span
                      className={`mb-1 text-[10px] font-black ${isPeak ? "text-[#F5A623]" : "text-[var(--color-primary)]"
                        }`}
                    >
                      {slot.count}
                    </span>
                  )}

                  {/* Bar */}
                  <div
                    style={{ height: `${Math.max(heightPercent, 6)}%` }}
                    className={`w-full rounded-t-md transition-all duration-200 ${slot.count === 0
                        ? "bg-[#e2e8f0]"
                        : isPeak
                          ? "bg-gradient-to-t from-[#F5A623] to-[#ffd074]"
                          : "bg-gradient-to-t from-[#00C2A8] to-[#6ee7d7]"
                      } ${isHovered ? "opacity-100 scale-105" : "opacity-90"}`}
                  />
                  <span className="mt-1 text-[9px] font-mono text-[var(--color-muted)] truncate max-w-full">
                    {slot.hour}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </AdminCard>

      {/* Peak Hours Overview by Day - Clickable to open driver list modal */}
      <AdminCard padding={18}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[var(--color-primary)]">
            <Zap size={16} className="text-[#F5A623]" /> Peak Hours Overview by Day
          </h3>
          <span className="text-xs text-[var(--color-muted)]">
            Click any day to view available drivers and schedules
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {DAYS.map((d) => {
            const driverCount = perDayDriverCounts[d.id];
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setModalDay(d.id)}
                className="group relative flex flex-col justify-between text-left rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-3.5 transition-all hover:border-[#00C2A8] hover:bg-[#effaf8] hover:shadow-sm"
              >
                <div>
                  <span className="text-xs font-extrabold text-[var(--color-primary)] group-hover:text-[#00C2A8]">
                    {d.label}
                  </span>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-[var(--color-primary)]">
                      {driverCount}
                    </span>
                    <span className="text-xs font-semibold text-[var(--color-muted)]">
                      driver{driverCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <span className="mt-3 text-[11px] font-extrabold text-[#00C2A8] group-hover:underline">
                  View drivers &rarr;
                </span>
              </button>
            );
          })}
        </div>
      </AdminCard>

      {/* Drivers Available Modal */}
      {modalDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-[var(--color-border)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 bg-[var(--color-background)]">
              <div>
                <h3 className="text-lg font-extrabold text-[var(--color-primary)]">
                  Drivers available on {DAYS.find((d) => d.id === modalDay)?.label}
                </h3>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">
                  {modalDayDrivers.length} driver{modalDayDrivers.length === 1 ? "" : "s"} active on this day
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalDay(null)}
                className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-primary)]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              {modalDayDrivers.length === 0 ? (
                <div className="py-8 text-center text-sm text-[var(--color-muted)]">
                  No drivers are scheduled for {DAYS.find((d) => d.id === modalDay)?.label}.
                </div>
              ) : (
                modalDayDrivers.map(({ driver, shifts }) => (
                  <div
                    key={driver.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[#f9fbfb] p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00C2A8]/15 text-[#00C2A8] font-bold text-xs">
                          <User size={16} />
                        </div>
                        <div>
                          <strong className="block text-sm font-bold text-[var(--color-primary)]">
                            {driver.name || "Unnamed driver"}{" "}
                            {driver.userNumber ? `#${driver.userNumber}` : ""}
                          </strong>
                          <span className="text-xs text-[var(--color-muted)] font-mono">
                            {driver.phone || "No phone"}
                          </span>
                        </div>
                      </div>
                      <span className="rounded-lg bg-[#00C2A8]/10 px-2.5 py-1 text-xs font-bold text-[#00C2A8]">
                        {shifts.length} shift{shifts.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {shifts.map((shift) => (
                        <div
                          key={shift._id}
                          className="flex items-center justify-between text-xs rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
                        >
                          <span className="truncate text-[var(--color-primary)] font-medium max-w-[240px]">
                            {shift.origin.address}
                          </span>
                          <span className="font-mono font-bold text-[#00C2A8] bg-[#effaf8] px-2 py-0.5 rounded-md">
                            from: {shift.startTime} to: {shift.endTime}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-[var(--color-border)] p-4 bg-[var(--color-background)] flex justify-end">
              <button
                type="button"
                onClick={() => setModalDay(null)}
                className="rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-extrabold text-white hover:bg-[var(--color-primary)]/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Table Section with Search Filter */}
      <AdminCard padding={0}>
        <div className="p-4 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[var(--color-primary)]">
              Weekly Driver Schedules {selectedDay !== "all" && `(${DAYS.find((d) => d.id === selectedDay)?.label})`}
            </h3>
            <span className="text-xs text-[var(--color-muted)]">
              Showing {visibleRows.length} of {initialRecords.length} registered drivers
            </span>
          </div>

          {/* Filter / Search Input */}
          <div className="relative min-w-[260px] sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, or #userNumber (e.g. #2)..."
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] pl-9 pr-8 py-2 text-xs font-medium text-[var(--color-primary)] placeholder-[var(--color-muted)] focus:border-[#00C2A8] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-primary)]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-[var(--color-border)]">
          {visibleRows.map((driver) => (
            <section key={driver.id} className="p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="block text-sm text-[var(--color-primary)]">
                      {driver.name || "Unnamed driver"}
                    </strong>
                    {driver.userNumber ? (
                      <span className="rounded-md bg-[var(--color-border)] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[var(--color-primary)]">
                        #{driver.userNumber}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs font-mono text-[var(--color-muted)]">
                    {driver.phone || "No phone"}
                  </span>
                </div>
                <span className="rounded-lg bg-[#00C2A8]/10 px-2.5 py-1 text-xs font-bold text-[#00C2A8]">
                  {driver.records.filter((record) => record.active).length} active shift{driver.records.filter((record) => record.active).length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {DAYS.filter((day) => selectedDay === "all" || day.id === selectedDay).map((day) => {
                  const shifts = driver.records.filter(
                    (item) => item.dayOfWeek === day.id && item.active,
                  );
                  return (
                    <div
                      key={day.id}
                      className={`min-w-0 rounded-lg border p-2.5 ${selectedDay === day.id ? "border-[#00C2A8] bg-[#00C2A8]/5" : "border-[var(--color-border)] bg-[var(--color-background)]"}`}
                    >
                      <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[var(--color-primary)]">
                        {day.short}
                      </p>
                      {shifts.length === 0 ? (
                        <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                          <Minus className="h-3.5 w-3.5" /> No shift
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {shifts.map((shift) => (
                            <div key={shift._id} className="min-w-0 rounded-md bg-[var(--color-secondary-tint)] px-2 py-2 text-xs text-[var(--color-primary)]">
                              <div className="flex items-start gap-1.5">
                                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-secondary)]" />
                                <span
                                  className="line-clamp-2 min-w-0 font-medium"
                                  title={shift.origin.address}
                                >
                                  {shift.origin.address}
                                </span>
                              </div>
                              <span className="mt-1 block font-mono text-[10px] font-bold text-[var(--color-muted)]">
                                {shift.startTime}–{shift.endTime}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        {visibleRows.length === 0 && (
          <p className="p-8 text-center text-sm text-[var(--color-muted)]">
            No drivers found matching your search criteria.
          </p>
        )}
      </AdminCard>
    </div>
  );
}
