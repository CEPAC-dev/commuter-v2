"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Route,
  Trash2,
  UserPlus,
  X,
  MapPin,
  Inbox,
  RotateCcw,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import AdminDateRangeCalendar from "@/components/admin/AdminDateRangeCalendar";
import AdminTripMap, { type TripMapPoint } from "@/components/admin/AdminTripMap";
import { AdminPageHeader } from "@/components/admin/layout";

interface DriverOption {
  _id: string;
  name?: string;
  phone?: string;
  startTime?: string;
  endTime?: string;
}

interface TripRow {
  _id: string;
  tripNumber?: number | null;
  date: string;
  pickupTime: string;
  arrivalTime: string;
  createdAt?: string;
  pickup?: { address?: string; lat?: number; lng?: number } | null;
  dropoff?: { address?: string; lat?: number; lng?: number } | null;
  status: string;
  userId?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
    userNumber?: number;
  } | null;
  driverId?: { _id?: string; name?: string; phone?: string } | null;
}

type StationRef = { id?: number; name?: string; lat?: number; lng?: number };

type TripDetail = TripRow &
  Record<string, unknown> & {
    pickupStation?: StationRef | null;
    dropoffStation?: StationRef | null;
    requestId?: {
      _id?: string;
      amountEgp?: number;
      paymentStatus?: string;
      status?: string;
      note?: string;
      dates?: string[];
      tripIds?: string[];
      createdAt?: string;
      paidAt?: string;
    } | null;
  };

type PendingDelete = {
  ids: string[];
  label: string;
};

type SearchMode = "tripNumber" | "userNumber";

const SEARCH_MODES: { value: SearchMode; label: string; placeholder: string }[] = [
  { value: "tripNumber", label: "Trip number", placeholder: "e.g. 1245" },
  { value: "userNumber", label: "User number", placeholder: "e.g. 87" },
];

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, { bg: string; color: string; label?: string }> = {
  pending_payment: { bg: "var(--color-warning-tint)", color: "var(--color-warning)", label: "Pending payment" },
  submitted: { bg: "var(--color-secondary-tint)", color: "var(--color-secondary)" },
  matched: { bg: "var(--color-secondary-tint)", color: "var(--color-secondary)" },
  scheduled: { bg: "var(--color-secondary-tint)", color: "var(--color-secondary)" },
  confirmed: { bg: "var(--color-secondary-tint)", color: "var(--color-secondary)" },
  in_progress: { bg: "var(--color-warning-tint)", color: "var(--color-warning)", label: "In progress" },
  active: { bg: "var(--color-warning-tint)", color: "var(--color-warning)" },
  completed: { bg: "var(--color-primary-tint)", color: "var(--color-muted)" },
  cancelled: { bg: "var(--color-danger-tint)", color: "var(--color-danger)" },
  time_out: { bg: "var(--color-danger-tint)", color: "var(--color-danger)", label: "Timed out" },
};

function getStatusStyle(status: string) {
  const key = status?.toLowerCase().replace(/\s+/g, "_") ?? "";
  return STATUS_STYLES[key] ?? { bg: "var(--color-primary-tint)", color: "var(--color-muted)" };
}

function initials(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function formatCreatedAt(value?: string) {
  if (!value) return { date: "—", time: "" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "—", time: "" };
  return {
    date: parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" }),
    time: parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
}

function tripLabelOf(trip: { tripNumber?: number | null; _id: string }) {
  return trip.tripNumber != null
    ? `#${String(trip.tripNumber).padStart(3, "0")}`
    : `#${String(trip._id).slice(-6)}`;
}

function formatTripDay(date?: string) {
  if (!date) return { pretty: "—", weekday: "" };
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return { pretty: date, weekday: "" };
  return {
    pretty: parsed.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }),
    weekday: parsed.toLocaleDateString(undefined, { weekday: "long" }),
  };
}

function titleize(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

const DETAIL_HIDDEN_KEYS = new Set([
  "__v",
  "_id",
  "pickup",
  "dropoff",
  "userId",
  "driverId",
  "requestId",
  "summary",
  "details",
  "passengers",
  "stops",
  "pickupStation",
  "dropoffStation",
  "pickupStationOptions",
  "dropoffStationOptions",
  "tripNumber",
  "date",
  "pickupTime",
  "arrivalTime",
  "status",
  "createdAt",
  "updatedAt",
]);

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function renderDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.name === "string") return record.name;
    if (typeof record.address === "string") return record.address;
    return "—";
  }
  if (typeof value === "string" && ISO_DATE_TIME.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString();
  }
  return String(value);
}

export default function AdminTripsPage() {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("tripNumber");
  const [range, setRange] = useState({ dateFrom: "", dateTo: "" });
  const [filters, setFilters] = useState({
    q: "",
    searchBy: "tripNumber" as SearchMode,
    dateFrom: "",
    dateTo: "",
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [modalTripId, setModalTripId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (filters.q) {
          params.set("q", filters.q);
          params.set("searchBy", filters.searchBy);
        }
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);

        const res = await fetch(`/api/admin/trips?${params.toString()}`);
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          trips?: TripRow[];
          totalCount?: number;
        } | null;
        if (!res.ok) {
          throw new Error(
            data?.error ?? `Failed to load trips (HTTP ${res.status})`,
          );
        }
        if (!active) return;
        setError(null);
        setTrips(data?.trips ?? []);
        setTotalCount(data?.totalCount ?? 0);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load trips");
        setTrips([]);
        setTotalCount(0);
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [page, filters, reloadKey]);

  const visibleIds = useMemo(() => trips.map((t) => t._id), [trips]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  function toggleSelectAll() {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  function applyFilters(next?: { dateFrom: string; dateTo: string }) {
    const nextRange = next ?? range;
    setLoading(true);
    setPage(1);
    setSelectedIds([]);
    setNotice(null);
    setFilters({
      q: searchInput.trim(),
      searchBy: searchMode,
      dateFrom: nextRange.dateFrom,
      dateTo: nextRange.dateTo,
    });
  }

  function handleRangeApply(next: { dateFrom: string; dateTo: string }) {
    setRange(next);
    applyFilters(next);
  }

  function updateSearchInput(value: string) {
    setSearchInput(value);
    setLoading(true);
    setPage(1);
    setSelectedIds([]);
    setNotice(null);
    setFilters((current) => ({
      ...current,
      q: value.trim(),
      searchBy: searchMode,
    }));
  }

  function updateSearchMode(mode: SearchMode) {
    setSearchMode(mode);
    setLoading(true);
    setPage(1);
    setSelectedIds([]);
    setNotice(null);
    setFilters((current) => ({
      ...current,
      q: searchInput.trim(),
      searchBy: mode,
    }));
  }

  function resetFilters() {
    setLoading(true);
    setSearchInput("");
    setSearchMode("tripNumber");
    setRange({ dateFrom: "", dateTo: "" });
    setPage(1);
    setSelectedIds([]);
    setNotice(null);
    setFilters({ q: "", searchBy: "tripNumber", dateFrom: "", dateTo: "" });
  }

  function goToPage(next: number) {
    setLoading(true);
    setPage(next);
    setSelectedIds([]);
  }

  function closeDeleteModal() {
    setPendingDelete(null);
    setPassword("");
    setDeleteError(null);
    setDeleting(false);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    if (!password.trim()) {
      setDeleteError("Admin password is required.");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/admin/trips?action=by-ids", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ ids: pendingDelete.ids }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete trips");

      const deletedIds = new Set(pendingDelete.ids);
      setSelectedIds((current) => current.filter((id) => !deletedIds.has(id)));
      setNotice(`Deleted ${data?.deletedCount ?? 0} trip(s).`);
      closeDeleteModal();
      refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete trips");
      setDeleting(false);
    }
  }

  function closeModal() {
    setModalTripId(null);
    setDrivers([]);
    setDriversError(null);
    setAssigningId(null);
  }

  async function openAssignModal(tripId: string) {
    setModalTripId(tripId);
    setDrivers([]);
    setDriversError(null);
    setDriversLoading(true);
    try {
      const res = await fetch(`/api/admin/trips/${tripId}/available-drivers`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load drivers");
      setDrivers(data.drivers ?? []);
    } catch (err) {
      setDriversError(err instanceof Error ? err.message : "Failed to load drivers");
    } finally {
      setDriversLoading(false);
    }
  }

  async function assignDriver(driverId: string) {
    if (!modalTripId) return;
    setAssigningId(driverId);
    setDriversError(null);
    try {
      const res = await fetch(`/api/admin/trips/${modalTripId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to assign driver");
      closeModal();
      refresh();
    } catch (err) {
      setDriversError(err instanceof Error ? err.message : "Failed to assign driver");
      setAssigningId(null);
    }
  }

  function closeDetail() {
    setDetailId(null);
    setDetail(null);
    setDetailError(null);
  }

  function openDetail(id: string) {
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    setDetailId(id);
  }

  const mapPoints = useMemo<TripMapPoint[]>(() => {
    if (!detail) return [];
    const candidates: (TripMapPoint | null)[] = [
      detail.pickup?.lat != null && detail.pickup?.lng != null
        ? {
            lat: detail.pickup.lat,
            lng: detail.pickup.lng,
            label: detail.pickup.address ?? "Origin",
            kind: "pickup",
          }
        : null,
      detail.dropoff?.lat != null && detail.dropoff?.lng != null
        ? {
            lat: detail.dropoff.lat,
            lng: detail.dropoff.lng,
            label: detail.dropoff.address ?? "Destination",
            kind: "dropoff",
          }
        : null,
      detail.pickupStation?.lat != null && detail.pickupStation?.lng != null
        ? {
            lat: detail.pickupStation.lat,
            lng: detail.pickupStation.lng,
            label: detail.pickupStation.name ?? "Pickup station",
            kind: "station",
          }
        : null,
      detail.dropoffStation?.lat != null && detail.dropoffStation?.lng != null
        ? {
            lat: detail.dropoffStation.lat,
            lng: detail.dropoffStation.lng,
            label: detail.dropoffStation.name ?? "Dropoff station",
            kind: "station",
          }
        : null,
    ];
    return candidates.filter((p): p is TripMapPoint => p !== null);
  }, [detail]);

  useEffect(() => {
    if (!detailId) return;
    let active = true;

    const run = async () => {
      try {
        const res = await fetch(`/api/admin/trips/${detailId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load trip details");
        if (!active) return;
        setDetail(data.trip ?? null);
        setDetailError(null);
      } catch (err) {
        if (!active) return;
        setDetailError(
          err instanceof Error ? err.message : "Failed to load trip details",
        );
      } finally {
        if (active) setDetailLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [detailId]);

  useEffect(() => {
    if (!modalTripId && !pendingDelete && !detailId) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (pendingDelete) closeDeleteModal();
      else if (modalTripId) closeModal();
      else closeDetail();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [modalTripId, pendingDelete, detailId]);

  return (
    <main className="trips-board">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');

        .trips-board {
          --ink: var(--color-primary);
          --teal: var(--color-secondary);
          --teal-deep: var(--color-secondary-deep);
          --amber: var(--color-accent);
          --rose: var(--color-danger);
          --slate: var(--color-muted);
          --line: var(--color-border);
          --canvas: var(--color-surface);
          --surface: var(--color-panel);
          font-family: 'Inter', system-ui, sans-serif;
          min-height: 100dvh;
          background: var(--canvas);
          padding: 32px 20px 80px;
        }
        .trips-board * { box-sizing: border-box; }
        .trips-board .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .trips-board .display { font-family: 'Space Grotesk', system-ui, sans-serif; }

        .trips-board table { width: 100%; border-collapse: collapse; }
        .trips-board thead th {
          text-align: left;
          padding: 12px 14px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--slate);
          border-bottom: 1px solid var(--line);
          white-space: nowrap;
          background: var(--color-background);
        }
        .trips-board tbody tr {
          border-bottom: 1px solid var(--line);
          transition: background 0.12s ease;
        }
        .trips-board tbody tr:hover { background: var(--color-secondary-tint); }
        .trips-board tbody tr.selected { background: var(--color-secondary-tint); }
        .trips-board tbody tr:last-child { border-bottom: none; }
        .trips-board td { padding: 14px; vertical-align: middle; }

        .trips-board input[type="checkbox"] {
          width: 16px; height: 16px;
          accent-color: var(--color-secondary-deep);
          cursor: pointer;
        }

        .filter-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 170px;
        }
        .filter-field span {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--slate);
        }
        .filter-field input {
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 14px;
          font-family: inherit;
          color: var(--ink);
          background: var(--color-panel);
          outline: none;
        }
        .filter-field input:focus { border-color: var(--teal); }
        .filter-field select {
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 14px;
          font-family: inherit;
          font-weight: 600;
          color: var(--ink);
          background: var(--color-panel);
          outline: none;
          min-height: 40px;
          cursor: pointer;
        }
        .filter-field select:focus { border-color: var(--teal); }

        .trips-board tbody tr.row-link { cursor: pointer; }
        .trips-board tbody tr.row-link:focus-visible {
          outline: 2px solid var(--teal);
          outline-offset: -2px;
        }

        .detail-drawer {
          position: fixed;
          top: 0;
          inset-inline-end: 0;
          height: 100dvh;
          width: min(560px, 100%);
          background: var(--color-panel);
          box-shadow: -12px 0 40px var(--color-shadow-strong);
          display: flex;
          flex-direction: column;
          animation: drawerIn 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @keyframes drawerIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .detail-drawer { animation: none; } }
        .detail-body { overflow-y: auto; padding: 20px 24px 32px; flex: 1; }
        .detail-section {
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 14px;
        }
        .detail-section h4 {
          margin: 0 0 12px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--slate);
        }
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px 16px;
        }
        .detail-item .k {
          display: block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--slate);
          margin-bottom: 3px;
        }
        .detail-item .v {
          font-size: 13.5px;
          color: var(--ink);
          font-weight: 500;
          word-break: break-word;
        }
        .map-legend {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--slate);
        }
        .map-legend i {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
        }
        .trips-board .leaflet-container { font-family: inherit; }

        .bulk-bar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; flex-wrap: wrap;
          padding: 12px 20px;
          background: var(--color-secondary-tint);
          border-bottom: 1px solid var(--line);
        }

        .addr-cell {
          display: flex;
          align-items: center;
          gap: 8px;
          max-width: 210px;
        }
        .addr-cell .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--teal); flex-shrink: 0; }
        .addr-cell .dot.end { background: var(--ink); }
        .addr-cell .txt {
          font-size: 13px;
          color: var(--ink);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .status-pill {
          display: inline-block;
          padding: 5px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .driver-chip { display: flex; align-items: center; gap: 9px; }
        .driver-chip .avatar {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--ink);
          color: var(--color-on-primary);
          font-size: 11px;
          font-weight: 600;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .driver-chip.unassigned .avatar { background: var(--line); color: var(--slate); }
        .driver-chip .name { font-size: 13px; color: var(--ink); font-weight: 500; }
        .driver-chip .unassigned-label { font-size: 13px; color: var(--slate); font-style: italic; }

        .action-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          font-family: inherit;
          transition: opacity 0.12s ease;
        }
        .action-btn:hover:not(:disabled) { opacity: 0.75; }
        .action-btn:disabled { opacity: 0.45; cursor: default; }
        .action-btn.assign { background: var(--color-secondary-tint); color: var(--teal-deep); }
        .action-btn.delete { background: var(--color-danger-tint); color: var(--rose); }
        .action-btn.solid-danger { background: var(--rose); color: var(--color-on-primary); }
        .action-btn.solid-ink { background: var(--ink); color: var(--color-on-primary); }
        .action-btn.ghost { background: var(--color-panel); color: var(--slate); border-color: var(--line); }

        .skeleton-row td { padding: 14px; }
        .skeleton-bar {
          height: 12px;
          border-radius: 4px;
          background: linear-gradient(90deg, var(--line) 25%, var(--color-background) 37%, var(--line) 63%);
          background-size: 400% 100%;
          animation: shimmer 1.4s ease infinite;
        }
        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .skeleton-bar { animation: none; }
        }

        .modal-overlay {
          position: fixed; inset: 0;
          background: var(--color-overlay);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          z-index: 1200;
          animation: fadeIn 0.15s ease;
        }
        .modal-panel {
          width: 100%; max-width: 460px;
          background: var(--color-panel);
          border-radius: 18px;
          padding: 24px;
          box-shadow: 0 20px 60px var(--color-shadow-strong);
          animation: panelIn 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
          max-height: 84vh;
          display: flex;
          flex-direction: column;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes panelIn { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .modal-overlay, .modal-panel { animation: none; }
        }

        .driver-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; padding-right: 2px; }
        .driver-row {
          display: flex; align-items: center; justify-content: space-between;
          border: 1px solid var(--color-border); border-radius: 12px; padding: 11px 13px;
          background: var(--color-surface); cursor: pointer; text-align: left; width: 100%;
          transition: border-color 0.12s ease, background 0.12s ease;
        }
        .driver-row:hover:not(:disabled) { border-color: var(--color-secondary); background: var(--color-secondary-tint); }
        .driver-row:disabled { cursor: default; opacity: 0.6; }
        .avail-chip {
          font-size: 11px; font-weight: 600;
          color: var(--color-muted); background: var(--color-border);
          padding: 3px 8px; border-radius: 999px;
          margin-top: 3px; display: inline-block;
        }
        .spinner {
          width: 14px; height: 14px;
          border: 2px solid var(--color-secondary-tint);
          border-top-color: var(--color-secondary-deep);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .modal-skel { display: flex; align-items: center; gap: 10px; padding: 11px 13px; }
      `}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <AdminPageHeader
          title="Trips"
          description={loading ? "Loading the board…" : `${totalCount} trip${totalCount === 1 ? "" : "s"} match the current filters`}
          icon={Route}
          actions={
            <>
            <Link
              href="/admin/trips"
              style={{ padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: "none", background: "var(--color-primary)", color: "var(--color-on-primary)" }}
            >
              Single Trips
            </Link>
            <Link
              href="/admin/rides"
              style={{ padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: "none", background: "var(--color-panel)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
            >
              Matched Rides
            </Link>
            </>
          }
        />

        {error ? (
          <p role="alert" style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "var(--color-danger-tint)", color: "var(--color-danger)", border: "1px solid var(--color-danger)", fontSize: 14 }}>
            {error}
          </p>
        ) : null}

        {notice ? (
          <p role="status" style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "var(--color-secondary-tint)", color: "var(--color-secondary)", border: "1px solid var(--color-secondary)", fontSize: 14 }}>
            {notice}
          </p>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-end",
            background: "var(--color-panel)",
            border: "1px solid var(--color-border)",
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            boxShadow: "0 6px 20px var(--color-shadow)",
          }}
        >
          <label className="filter-field">
            <span>Search by</span>
            <select
              value={searchMode}
              onChange={(e) => updateSearchMode(e.target.value as SearchMode)}
            >
              {SEARCH_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field" style={{ flex: "1 1 280px" }}>
            <span>Search value</span>
            <input
              value={searchInput}
              onChange={(e) => updateSearchInput(e.target.value)}
              inputMode="numeric"
              placeholder={
                SEARCH_MODES.find((m) => m.value === searchMode)?.placeholder
              }
            />
          </label>
          <div className="filter-field" style={{ minWidth: 0 }}>
            <span>Trip date</span>
            <AdminDateRangeCalendar
              dateFrom={range.dateFrom}
              dateTo={range.dateTo}
              onApply={handleRangeApply}
            />
          </div>
          <button type="button" onClick={resetFilters} className="action-btn ghost">
            <RotateCcw size={14} /> Reset
          </button>
        </div>

        <section style={{ borderRadius: "var(--radius-md)", background: "var(--color-panel)", border: "1px solid var(--color-border)", boxShadow: "0 10px 35px var(--color-shadow)", overflow: "hidden", borderTop: "3px solid var(--color-secondary)" }}>
          {selectedIds.length > 0 ? (
            <div className="bulk-bar">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
                {selectedIds.length} trip{selectedIds.length === 1 ? "" : "s"} selected
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="action-btn ghost" onClick={() => setSelectedIds([])}>
                  Clear selection
                </button>
                <button
                  type="button"
                  className="action-btn solid-danger"
                  onClick={() =>
                    setPendingDelete({
                      ids: selectedIds,
                      label: `${selectedIds.length} selected trip${selectedIds.length === 1 ? "" : "s"}`,
                    })
                  }
                >
                  <Trash2 size={14} /> Delete selected
                </button>
              </div>
            </div>
          ) : null}

          <div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44 }}>
                    <input
                      type="checkbox"
                      aria-label="Select every trip on this page"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      disabled={loading || trips.length === 0}
                    />
                  </th>
                  <th>Trip #</th>
                  <th>Trip date</th>
                  <th>User</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Created</th>
                  <th>Pickup time</th>
                  <th>Dropoff time</th>
                  <th>Status</th>
                  <th>Driver</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="skeleton-row">
                      {Array.from({ length: 12 }).map((__, j) => (
                        <td key={`skeleton-${i}-${j}`}>
                          <div className="skeleton-bar" style={{ width: j === 0 ? 16 : 80 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : trips.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ padding: "56px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
                        <Inbox size={28} style={{ color: "var(--color-border)" }} />
                        <p style={{ margin: 0, fontWeight: 600, color: "var(--color-primary)", fontSize: 15 }}>No trips found</p>
                        <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 13 }}>Try clearing the filters or widening the date range.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  trips.map((trip) => {
                    const statusStyle = getStatusStyle(trip.status);
                    const driverName = trip.driverId?.name;
                    const created = formatCreatedAt(trip.createdAt);
                    const tripDay = formatTripDay(trip.date);
                    const isSelected = selectedIds.includes(trip._id);
                    const tripLabel = tripLabelOf(trip);
                    return (
                      <tr
                        key={trip._id}
                        className={`row-link${isSelected ? " selected" : ""}`}
                        tabIndex={0}
                        role="button"
                        aria-label={`Open details for trip ${tripLabel}`}
                        onClick={() => openDetail(trip._id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openDetail(trip._id);
                          }
                        }}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select trip ${tripLabel}`}
                            checked={isSelected}
                            onChange={() => toggleSelect(trip._id)}
                          />
                        </td>
                        <td>
                          <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
                            {tripLabel}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: 13, color: "var(--color-primary)", fontWeight: 500 }}>{tripDay.pretty}</div>
                          <div style={{ fontSize: 12, color: "var(--color-secondary-deep)", marginTop: 2, fontWeight: 600 }}>{tripDay.weekday}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13, color: "var(--color-primary)", fontWeight: 500 }}>
                            {trip.userId?.name ?? "Unknown user"}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>
                            {trip.userId?.userNumber != null
                              ? `User #${trip.userId.userNumber}`
                              : (trip.userId?.email ?? "—")}
                          </div>
                        </td>
                        <td>
                          <div className="addr-cell" title={trip.pickup?.address ?? undefined}>
                            <span className="dot" />
                            <span className="txt">{trip.pickup?.address ?? "No pickup set"}</span>
                          </div>
                        </td>
                        <td>
                          <div className="addr-cell" title={trip.dropoff?.address ?? undefined}>
                            <span className="dot end" />
                            <span className="txt">{trip.dropoff?.address ?? "No dropoff set"}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13, color: "var(--color-primary)" }}>{created.date}</div>
                          <div className="mono" style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>{created.time}</div>
                        </td>
                        <td>
                          <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>{trip.pickupTime}</div>
                        </td>
                        <td>
                          <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>{trip.arrivalTime}</div>
                        </td>
                        <td>
                          <span className="status-pill" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                            {statusStyle.label ?? trip.status}
                          </span>
                        </td>
                        <td>
                          <div className={`driver-chip ${driverName ? "" : "unassigned"}`}>
                            <span className="avatar">
                              {driverName ? initials(driverName) : <MapPin size={12} />}
                            </span>
                            {driverName ? (
                              <span className="name">{driverName}</span>
                            ) : (
                              <span className="unassigned-label">Unassigned</span>
                            )}
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" onClick={() => void openAssignModal(trip._id)} className="action-btn assign">
                              <UserPlus size={14} /> Assign
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDelete({ ids: [trip._id], label: `trip ${tripLabel}` })}
                              className="action-btn delete"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              padding: "14px 20px",
              borderTop: "1px solid var(--color-border)",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--color-muted)" }}>
              Page {page} of {totalPages}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="action-btn ghost" disabled={loading || page <= 1} onClick={() => goToPage(Math.max(1, page - 1))}>
                <ChevronLeft size={14} /> Previous
              </button>
              <button type="button" className="action-btn ghost" disabled={loading || page >= totalPages} onClick={() => goToPage(Math.min(totalPages, page + 1))}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </section>
      </div>

      {detailId ? (
        <div
          className="trips-board modal-overlay"
          style={{ alignItems: "stretch", justifyContent: "flex-end", padding: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDetail();
          }}
        >
          <aside
            className="detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Trip details"
          >
            <header
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--color-border)",
                borderTop: "3px solid var(--color-secondary)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <p className="mono" style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-secondary-deep)" }}>
                  Trip details
                </p>
                <h3 className="display" style={{ margin: "5px 0 0", fontSize: 20, fontWeight: 700, color: "var(--color-primary)" }}>
                  {detail ? tripLabelOf(detail) : "Loading…"}
                </h3>
                {detail ? (
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-muted)" }}>
                    {detail.date} · {detail.pickupTime} → {detail.arrivalTime}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeDetail}
                aria-label="Close details"
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 4, flexShrink: 0 }}
              >
                <X size={20} />
              </button>
            </header>

            <div className="detail-body">
              {detailLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={`detail-skel-${i}`} className="skeleton-bar" style={{ height: 16 }} />
                  ))}
                </div>
              ) : detailError ? (
                <p role="alert" style={{ margin: 0, padding: "12px 14px", borderRadius: 10, background: "var(--color-danger-tint)", color: "var(--color-danger)", border: "1px solid var(--color-danger)", fontSize: 13 }}>
                  {detailError}
                </p>
              ) : detail ? (
                <>
                  {mapPoints.length > 0 ? (
                    <div className="detail-section" style={{ padding: 12 }}>
                      <AdminTripMap key={detail._id} points={mapPoints} />
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, paddingInline: 4 }}>
                        <span className="map-legend"><i style={{ background: "var(--color-secondary)" }} /> Origin</span>
                        <span className="map-legend"><i style={{ background: "var(--color-primary)" }} /> Destination</span>
                        {detail.pickupStation || detail.dropoffStation ? (
                          <span className="map-legend"><i style={{ background: "var(--color-accent)" }} /> Station</span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="detail-section">
                    <h4>Route</h4>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="k">Origin</span>
                        <span className="v">{detail.pickup?.address ?? "—"}</span>
                      </div>
                      <div className="detail-item">
                        <span className="k">Destination</span>
                        <span className="v">{detail.dropoff?.address ?? "—"}</span>
                      </div>
                      <div className="detail-item">
                        <span className="k">Trip date</span>
                        <span className="v">
                          {formatTripDay(detail.date).pretty}
                          {formatTripDay(detail.date).weekday
                            ? ` · ${formatTripDay(detail.date).weekday}`
                            : ""}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="k">Status</span>
                        <span className="v">
                          <span
                            className="status-pill"
                            style={{
                              background: getStatusStyle(detail.status).bg,
                              color: getStatusStyle(detail.status).color,
                            }}
                          >
                            {getStatusStyle(detail.status).label ?? detail.status}
                          </span>
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="k">Pickup time</span>
                        <span className="v mono">{detail.pickupTime}</span>
                      </div>
                      <div className="detail-item">
                        <span className="k">Dropoff time</span>
                        <span className="v mono">{detail.arrivalTime}</span>
                      </div>
                      <div className="detail-item">
                        <span className="k">Created</span>
                        <span className="v">
                          {formatCreatedAt(detail.createdAt).date}{" "}
                          {formatCreatedAt(detail.createdAt).time}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="k">Last updated</span>
                        <span className="v">
                          {formatCreatedAt(detail.updatedAt as string | undefined).date}{" "}
                          {formatCreatedAt(detail.updatedAt as string | undefined).time}
                        </span>
                      </div>
                    </div>
                  </div>

                  {detail.pickupStation || detail.dropoffStation ? (
                    <div className="detail-section">
                      <h4>Stations</h4>
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="k">Pickup station</span>
                          <span className="v">{detail.pickupStation?.name ?? "—"}</span>
                        </div>
                        <div className="detail-item">
                          <span className="k">Dropoff station</span>
                          <span className="v">{detail.dropoffStation?.name ?? "—"}</span>
                        </div>
                        <div className="detail-item">
                          <span className="k">Walk to station</span>
                          <span className="v">{renderDetailValue(detail.walkingMinToStation)} min</span>
                        </div>
                        <div className="detail-item">
                          <span className="k">Walk from station</span>
                          <span className="v">{renderDetailValue(detail.walkingMinFromStation)} min</span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="detail-section">
                    <h4>Passenger</h4>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="k">Name</span>
                        <span className="v">{detail.userId?.name ?? "—"}</span>
                      </div>
                      <div className="detail-item">
                        <span className="k">User number</span>
                        <span className="v mono">
                          {detail.userId?.userNumber ?? "—"}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="k">Email</span>
                        <span className="v">{detail.userId?.email ?? "—"}</span>
                      </div>
                      <div className="detail-item">
                        <span className="k">Phone</span>
                        <span className="v">{detail.userId?.phone ?? "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h4>Driver</h4>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="k">Name</span>
                        <span className="v">{detail.driverId?.name ?? "Unassigned"}</span>
                      </div>
                      <div className="detail-item">
                        <span className="k">Phone</span>
                        <span className="v">{detail.driverId?.phone ?? "—"}</span>
                      </div>
                    </div>
                  </div>

                  {detail.requestId ? (
                    <div className="detail-section">
                      <h4>Booking request</h4>
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="k">Trips in request</span>
                          <span className="v">{detail.requestId.tripIds?.length ?? 0}</span>
                        </div>
                        <div className="detail-item">
                          <span className="k">Request total</span>
                          <span className="v">
                            {detail.requestId.amountEgp != null
                              ? `${detail.requestId.amountEgp} EGP`
                              : "—"}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="k">Payment status</span>
                          <span className="v">{detail.requestId.paymentStatus ?? "—"}</span>
                        </div>
                        <div className="detail-item">
                          <span className="k">Request status</span>
                          <span className="v">{detail.requestId.status ?? "—"}</span>
                        </div>
                        <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                          <span className="k">Dates</span>
                          <span className="v">
                            {detail.requestId.dates?.length
                              ? detail.requestId.dates.join(" · ")
                              : "—"}
                          </span>
                        </div>
                        {detail.requestId.note ? (
                          <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                            <span className="k">Note</span>
                            <span className="v">{detail.requestId.note}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="detail-section">
                    <h4>Trip record</h4>
                    <div className="detail-grid">
                      {Object.entries(detail)
                        .filter(([key]) => !DETAIL_HIDDEN_KEYS.has(key))
                        .map(([key, value]) => (
                          <div className="detail-item" key={key}>
                            <span className="k">{titleize(key)}</span>
                            <span className="v">{renderDetailValue(value)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <footer
              style={{
                padding: "14px 24px",
                borderTop: "1px solid var(--color-border)",
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="action-btn assign"
                disabled={!detail}
                onClick={() => {
                  if (!detail) return;
                  closeDetail();
                  void openAssignModal(detail._id);
                }}
              >
                <UserPlus size={14} /> Assign driver
              </button>
              <button
                type="button"
                className="action-btn delete"
                disabled={!detail}
                onClick={() => {
                  if (!detail) return;
                  const label = `trip ${tripLabelOf(detail)}`;
                  closeDetail();
                  setPendingDelete({ ids: [detail._id], label });
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </footer>
          </aside>
        </div>
      ) : null}

      {pendingDelete ? (
        <div
          className="trips-board modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) closeDeleteModal();
          }}
        >
          <form
            className="modal-panel"
            style={{ maxWidth: 420 }}
            role="dialog"
            aria-modal="true"
            aria-label="Confirm trip deletion"
            onSubmit={(e) => {
              e.preventDefault();
              void confirmDelete();
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--color-danger-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ShieldAlert size={18} style={{ color: "var(--color-danger)" }} />
              </div>
              <div>
                <h3 className="display" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--color-primary)" }}>
                  Delete {pendingDelete.label}
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-muted)" }}>
                  This permanently removes the record from the database. Enter the admin password to confirm.
                </p>
              </div>
            </div>

            <label className="filter-field" style={{ minWidth: 0 }}>
              <span>Admin password</span>
              <input
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
              />
            </label>

            {deleteError ? (
              <p role="alert" style={{ margin: "12px 0 0", padding: "10px 12px", borderRadius: 10, background: "var(--color-danger-tint)", color: "var(--color-danger)", border: "1px solid var(--color-danger)", fontSize: 13 }}>
                {deleteError}
              </p>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button type="button" className="action-btn ghost" onClick={closeDeleteModal} disabled={deleting}>
                Cancel
              </button>
              <button type="submit" className="action-btn solid-danger" disabled={deleting}>
                {deleting ? <span className="spinner" /> : <Trash2 size={14} />}
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {modalTripId ? (
        <div
          className="trips-board modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Assign driver">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
              <div>
                <h3 className="display" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--color-primary)" }}>Assign driver</h3>
                {(() => {
                  const trip = trips.find((t) => t._id === modalTripId);
                  return trip ? (
                    <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--color-muted)" }}>
                      {trip.tripNumber != null ? `#${String(trip.tripNumber).padStart(3, "0")}` : ""} · {trip.date} · {trip.pickupTime}
                    </p>
                  ) : null;
                })()}
              </div>
              <button type="button" onClick={closeModal} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 4, flexShrink: 0 }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: "6px 0 16px", fontSize: 13, color: "var(--color-muted)" }}>
              Showing drivers available for this trip&apos;s date and time.
            </p>

            {driversError ? (
              <p role="alert" style={{ margin: "0 0 14px", padding: "10px 12px", borderRadius: 10, background: "var(--color-danger-tint)", color: "var(--color-danger)", border: "1px solid var(--color-danger)", fontSize: 13 }}>
                {driversError}
              </p>
            ) : null}

            {driversLoading ? (
              <div className="driver-list">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={`driver-skel-${i}`} className="modal-skel">
                    <div className="skeleton-bar" style={{ width: 30, height: 30, borderRadius: "50%" }} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div className="skeleton-bar" style={{ width: "50%" }} />
                      <div className="skeleton-bar" style={{ width: "30%", height: 9 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : drivers.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "24px 8px", textAlign: "center" }}>
                <MapPin size={22} style={{ color: "var(--color-border)" }} />
                <p style={{ margin: 0, fontSize: 14, color: "var(--color-muted)" }}>No drivers are available for this trip&apos;s date.</p>
              </div>
            ) : (
              <div className="driver-list">
                {drivers.map((driver, index) => {
                  const id = String(driver._id);
                  const isAssigning = assigningId === id;
                  return (
                    <button
                      key={driver._id ? `${driver._id}-${index}` : `driver-${index}`}
                      type="button"
                      disabled={assigningId !== null}
                      onClick={() => void assignDriver(id)}
                      className="driver-row"
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {initials(driver.name)}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <strong style={{ color: "var(--color-primary)", fontSize: 14, display: "block" }}>{driver.name ?? "Driver"}</strong>
                          <span style={{ color: "var(--color-muted)", fontSize: 12.5 }}>{driver.phone ?? "No phone on file"}</span>
                          {driver.startTime && driver.endTime ? (
                            <span className="mono avail-chip">{driver.startTime}–{driver.endTime}</span>
                          ) : null}
                        </span>
                      </span>
                      <span style={{ color: "var(--color-secondary-deep)", fontWeight: 700, fontSize: 13, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                        {isAssigning ? <span className="spinner" /> : null}
                        {isAssigning ? "Assigning…" : "Assign"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}