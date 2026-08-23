"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  RotateCcw,
  Route,
  Trash2,
  UserCog,
  X,
} from "lucide-react";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import AdminDateRangeCalendar from "@/components/admin/AdminDateRangeCalendar";
import AdminTripMap, {
  type TripMapPoint,
} from "@/components/admin/AdminTripMap";
import { VEHICLES, type VehicleKey } from "@/lib/config/vehicles";

type RidePassenger = {
  tripId?: string;
  userId?: string;
  numberOfPassengers?: number;
  tripCost?: number;
  pickupOrder?: number;
  dropoffOrder?: number;
};

type RidePassengerDetail = {
  userId: string;
  tripId?: string;
  pickupOrder?: number;
  dropoffOrder?: number;
  numberOfPassengers: number;
  status?: string;
  user?: {
    userNumber?: number;
    name?: string;
    phone?: string;
    profilePic?: string | null;
  } | null;
};

type RideRouteStop = {
  point?: { address?: string; lat?: number; lng?: number };
  arrival?: string;
  departure?: string;
  boarding?: RidePassenger[];
  alighting?: RidePassenger[];
  boardingNumber?: number;
  alightingNumber?: number;
  waitingMinutes?: number;
};

interface RideRow {
  _id: string;
  rideNumber?: number | null;
  date: string;
  startTime: string;
  endTime: string;
  vehicleType: string;
  rideType: string;
  status: string;
  totalCost: number;
  driverId?: {
    _id?: string;
    name?: string;
    phone?: string;
    email?: string;
  } | null;
  assignedDriver?: {
    name?: string;
    phone?: string;
    carBrand?: string;
    carModel?: string;
    plate?: string;
  } | null;
  passengers?: RidePassenger[];
  route?: RideRouteStop[];
  pickupStation?: { name?: string };
  dropoffStation?: { name?: string };
  availability?: {
    availabilityNumber?: number;
    startTime?: string;
    endTime?: string;
    status?: string;
  } | null;
  passengerDetails?: RidePassengerDetail[];
}

type AvailabilityOption = {
  _id: string;
  availabilityNumber?: number;
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  matched?: boolean;
  startLocation?: { address?: string };
  endLocation?: { address?: string };
  driverId?: { _id?: string; name?: string; phone?: string } | null;
};

type SearchMode = "rideNumber" | "driverNumber";

const SEARCH_MODES: {
  value: SearchMode;
  label: string;
  placeholder: string;
}[] = [
  { value: "rideNumber", label: "Ride number", placeholder: "e.g. 330" },
  { value: "driverNumber", label: "Driver number", placeholder: "e.g. 87" },
];

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<
  string,
  { bg: string; color: string; label?: string }
> = {
  matched: { bg: "rgba(0,194,168,0.12)", color: "#00877A", label: "Matched" },
  confirmed: {
    bg: "rgba(0,194,168,0.12)",
    color: "#00877A",
    label: "Confirmed",
  },
  active: { bg: "rgba(232,163,61,0.16)", color: "#B4790C", label: "Active" },
  completed: {
    bg: "rgba(90,106,122,0.12)",
    color: "#4A5A6A",
    label: "Completed",
  },
  cancelled: {
    bg: "rgba(225,82,82,0.12)",
    color: "#C13E3E",
    label: "Cancelled",
  },
};

function getStatusStyle(status: string) {
  const key = status?.toLowerCase() ?? "";
  return (
    STATUS_STYLES[key] ?? {
      bg: "rgba(90,106,122,0.1)",
      color: "#5A6A7A",
      label: status,
    }
  );
}

function initials(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function to12h(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function ridePassengers(ride: Pick<RideRow, "passengers" | "route">) {
  if (ride.passengers?.length) return ride.passengers;

  const passengersByTrip = new Map<string, RidePassenger>();
  for (const stop of ride.route ?? []) {
    for (const passenger of [
      ...(stop.boarding ?? []),
      ...(stop.alighting ?? []),
    ]) {
      const tripId = passenger.tripId;
      if (tripId && !passengersByTrip.has(tripId)) {
        passengersByTrip.set(tripId, passenger);
      }
    }
  }
  return [...passengersByTrip.values()];
}

function passengerCount(ride: Pick<RideRow, "passengers" | "route">) {
  const passengers = ridePassengers(ride);
  if (passengers.length) {
    return passengers.reduce(
      (total, passenger) => total + (passenger.numberOfPassengers ?? 1),
      0,
    );
  }
  return (ride.route ?? []).reduce(
    (total, stop) => total + (stop.boardingNumber ?? 0),
    0,
  );
}

function rideMapPoints(
  ride: Pick<RideRow, "route" | "pickupStation" | "dropoffStation">,
): TripMapPoint[] {
  const routePoints: TripMapPoint[] = [];
  for (const [index, stop] of (ride.route ?? []).entries()) {
    const { lat, lng, address } = stop.point ?? {};
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      continue;
    }
    routePoints.push({
      lat,
      lng,
      label: `${index + 1}. ${address ?? "Route stop"}`,
      kind: "stop",
      order: index + 1,
    });
  }

  if (routePoints.length) return routePoints;

  const stationPoints: TripMapPoint[] = [];
  for (const [index, station] of [
    ride.pickupStation,
    ride.dropoffStation,
  ].entries()) {
    const point = station as
      | { name?: string; lat?: number; lng?: number }
      | undefined;
    const lat = point?.lat;
    const lng = point?.lng;
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      continue;
    }
    stationPoints.push({
      lat,
      lng,
      label:
        point?.name ?? (index === 0 ? "Pickup station" : "Dropoff station"),
      kind: index === 0 ? "pickup" : "dropoff",
      order: index + 1,
    });
  }
  return stationPoints;
}

function googleMapsUrl(points: TripMapPoint[]) {
  if (points.length < 2) return null;
  const [origin, ...remaining] = points;
  const destination = remaining.pop();
  if (!origin || !destination) return null;

  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
  });
  if (remaining.length) {
    params.set(
      "waypoints",
      remaining.map((point) => `${point.lat},${point.lng}`).join("|"),
    );
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export default function AdminRidesPage() {
  const [rides, setRides] = useState<RideRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("rideNumber");
  const [range, setRange] = useState({ dateFrom: "", dateTo: "" });
  const [filters, setFilters] = useState({
    q: "",
    searchBy: "rideNumber" as SearchMode,
    dateFrom: "",
    dateTo: "",
    vehicleType: "",
    rideType: "",
    status: "",
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RideRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [passengerActionTripId, setPassengerActionTripId] = useState<
    string | null
  >(null);
  const [passengerActionError, setPassengerActionError] = useState<
    string | null
  >(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(
    null,
  );
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reassignRide, setReassignRide] = useState<RideRow | null>(null);
  const [availOptions, setAvailOptions] = useState<AvailabilityOption[]>([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [availSearch, setAvailSearch] = useState("");
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassigningId, setReassigningId] = useState<string | null>(null);

  const detailMapPoints = useMemo(
    () => (detail ? rideMapPoints(detail) : []),
    [detail],
  );
  const detailGoogleMapsUrl = useMemo(
    () => googleMapsUrl(detailMapPoints),
    [detailMapPoints],
  );

  function refresh() {
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  function openReassign(ride: RideRow) {
    setReassignRide(ride);
    setAvailOptions([]);
    setAvailSearch("");
    setReassignError(null);
    setAvailLoading(true);
  }

  function closeReassign() {
    setReassignRide(null);
    setAvailOptions([]);
    setAvailSearch("");
    setReassignError(null);
    setReassigningId(null);
  }

  async function confirmReassign(availabilityId: string) {
    if (!reassignRide) return;
    setReassigningId(availabilityId);
    setReassignError(null);
    try {
      const res = await fetch(`/api/admin/rides/${reassignRide._id}/reassign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availabilityId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to reassign driver");
      closeReassign();
      refresh();
    } catch (err) {
      setReassignError(
        err instanceof Error ? err.message : "Failed to reassign driver",
      );
    } finally {
      setReassigningId(null);
    }
  }

  async function deleteRide(id: string) {
    const confirmed = window.confirm(
      "Cancel and delete this ride? This will unassign the trips.",
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/rides/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data.error ?? "Failed to delete ride");
      setRides((current) => current.filter((ride) => ride._id !== id));
      setTotalCount((current) => Math.max(0, current - 1));
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete ride");
    }
  }

  async function deleteSelectedRides() {
    if (!pendingDeleteIds?.length) return;
    if (!password.trim()) {
      setDeleteError("Admin password is required.");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/admin/rides", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({ ids: pendingDeleteIds }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(data?.error ?? "Failed to delete selected rides");
      const deletedIds = new Set(pendingDeleteIds);
      setRides((current) =>
        current.filter((ride) => !deletedIds.has(ride._id)),
      );
      setTotalCount((current) =>
        Math.max(0, current - pendingDeleteIds.length),
      );
      setSelectedIds((current) => current.filter((id) => !deletedIds.has(id)));
      setPendingDeleteIds(null);
      setPassword("");
      refresh();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete selected rides",
      );
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    let active = true;

    const loadRides = async () => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (filters.q) {
          params.set("q", filters.q);
          params.set("searchBy", filters.searchBy);
        }
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);
        if (filters.vehicleType) params.set("vehicleType", filters.vehicleType);
        if (filters.rideType) params.set("rideType", filters.rideType);
        if (filters.status) params.set("status", filters.status);

        const res = await fetch(`/api/admin/rides?${params.toString()}`);
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          rides?: RideRow[];
          totalCount?: number;
        } | null;
        if (!res.ok) {
          throw new Error(
            data?.error ?? `Failed to load rides (HTTP ${res.status})`,
          );
        }
        if (!active) return;
        setError(null);
        setRides(data?.rides ?? []);
        setTotalCount(data?.totalCount ?? 0);
        setSelectedIds([]);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load rides");
        setRides([]);
        setTotalCount(0);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadRides();
    return () => {
      active = false;
    };
  }, [page, filters, reloadKey]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const visibleIds = useMemo(() => rides.map((ride) => ride._id), [rides]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  function toggleSelect(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  }

  function updateSearchInput(value: string) {
    setSearchInput(value);
    setLoading(true);
    setPage(1);
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
    setFilters((current) => ({
      ...current,
      q: searchInput.trim(),
      searchBy: mode,
    }));
  }

  function updateFilter(
    field: "vehicleType" | "rideType" | "status",
    value: string,
  ) {
    setLoading(true);
    setPage(1);
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function applyDateRange(next: { dateFrom: string; dateTo: string }) {
    setRange(next);
    setLoading(true);
    setPage(1);
    setFilters((current) => ({
      ...current,
      dateFrom: next.dateFrom,
      dateTo: next.dateTo,
    }));
  }

  function resetFilters() {
    setLoading(true);
    setPage(1);
    setSearchInput("");
    setSearchMode("rideNumber");
    setRange({ dateFrom: "", dateTo: "" });
    setFilters({
      q: "",
      searchBy: "rideNumber",
      dateFrom: "",
      dateTo: "",
      vehicleType: "",
      rideType: "",
      status: "",
    });
  }

  function openDetail(id: string) {
    setDetailId(id);
    setDetail(null);
    setDetailError(null);
    setPassengerActionError(null);
    setDetailLoading(true);
  }

  function closeDetail() {
    setDetailId(null);
    setDetail(null);
    setDetailError(null);
  }

  async function markPassengerStatus(
    tripId: string,
    status: "no_show" | "waiting",
  ) {
    if (!detailId) return;
    setPassengerActionTripId(tripId);
    setPassengerActionError(null);
    try {
      const res = await fetch(`/api/admin/rides/${detailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Unable to update passenger status.");
      }
      setDetail((current) =>
        current
          ? {
              ...current,
              passengerDetails: current.passengerDetails?.map((passenger) =>
                passenger.tripId === tripId
                  ? { ...passenger, status }
                  : passenger,
              ),
            }
          : current,
      );
    } catch (err) {
      setPassengerActionError(
        err instanceof Error
          ? err.message
          : "Unable to update passenger status.",
      );
    } finally {
      setPassengerActionTripId(null);
    }
  }
  useEffect(() => {
    if (!detailId) return;
    let active = true;

    const loadDetail = async () => {
      try {
        const res = await fetch(`/api/admin/rides/${detailId}`);
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          ride?: RideRow;
        } | null;
        if (!res.ok) {
          throw new Error(
            data?.error ?? `Failed to load ride details (HTTP ${res.status})`,
          );
        }
        if (!active) return;
        setDetail(data?.ride ?? null);
        setDetailError(null);
      } catch (err) {
        if (!active) return;
        setDetailError(
          err instanceof Error ? err.message : "Failed to load ride details",
        );
      } finally {
        if (active) setDetailLoading(false);
      }
    };

    void loadDetail();
    return () => {
      active = false;
    };
  }, [detailId]);

  useEffect(() => {
    if (!reassignRide) return;
    let active = true;

    const loadAvailabilities = async () => {
      try {
        const params = new URLSearchParams({
          date: reassignRide.date,
          limit: "200",
        });
        const res = await fetch(`/api/admin/availability?${params.toString()}`);
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          records?: AvailabilityOption[];
        } | null;
        if (!res.ok) {
          throw new Error(
            data?.error ?? `Failed to load availabilities (HTTP ${res.status})`,
          );
        }
        if (!active) return;
        setAvailOptions(data?.records ?? []);
        setReassignError(null);
      } catch (err) {
        if (!active) return;
        setReassignError(
          err instanceof Error ? err.message : "Failed to load availabilities",
        );
      } finally {
        if (active) setAvailLoading(false);
      }
    };

    void loadAvailabilities();
    return () => {
      active = false;
    };
  }, [reassignRide]);

  const filteredAvailabilities = useMemo(() => {
    const term = availSearch.trim().toLowerCase();
    if (!term) return availOptions;
    return availOptions.filter((option) =>
      [
        option.availabilityNumber != null
          ? `#${option.availabilityNumber}`
          : "",
        option.driverId?.name,
        option.driverId?.phone,
        option.startTime,
        option.endTime,
        option.status,
        option.startLocation?.address,
        option.endLocation?.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [availOptions, availSearch]);

  return (
    <main className="rides-board">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');

        .rides-board {
          --ink: #0B1E3D;
          --teal: #00C2A8;
          --teal-deep: #00877A;
          --amber: #E8A33D;
          --rose: #E15252;
          --slate: #5A6A7A;
          --line: #E6EAEC;
          --canvas: #F6F8F7;
          font-family: 'Inter', system-ui, sans-serif;
          min-height: 100dvh;
          background: var(--canvas);
          padding: 32px 20px 80px;
        }
        .rides-board * { box-sizing: border-box; }
        .rides-board .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .rides-board .display { font-family: 'Space Grotesk', system-ui, sans-serif; }

        .tab-btn {
          padding: 10px 20px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 14px;
          text-decoration: none;
          transition: all 0.15s ease;
        }
        .tab-btn.active {
          background: var(--ink);
          color: #ffffff;
        }
        .tab-btn.inactive {
          background: #ffffff;
          color: var(--slate);
          border: 1px solid var(--line);
        }
        .filter-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 150px;
        }
        .filter-field span {
          color: var(--slate);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .filter-field input, .filter-field select {
          min-height: 40px;
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 8px 10px;
          color: var(--ink);
          background: #fff;
          font: 600 14px inherit;
        }
        .filter-field input:focus, .filter-field select:focus { outline: 2px solid rgba(0,194,168,0.3); border-color: var(--teal); }

        .rides-board table { width: 100%; border-collapse: collapse; }
        .rides-board thead th {
          text-align: left;
          padding: 12px 16px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--slate);
          border-bottom: 1px solid var(--line);
        }
        .rides-board tbody tr {
          border-bottom: 1px solid var(--line);
          transition: background 0.12s ease;
        }
        .rides-board tbody tr:hover { background: rgba(0,194,168,0.035); }
        .rides-board tbody tr:last-child { border-bottom: none; }
        .rides-board td { padding: 16px; vertical-align: middle; }
        .rides-board input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--teal-deep); cursor: pointer; }

        .route-line {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 220px;
        }
        .route-line .stops {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .route-line .addr {
          font-size: 13px;
          color: var(--ink);
          max-width: 240px;
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
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .action-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: opacity 0.12s ease;
        }
        .action-btn:hover { opacity: 0.75; }
        .action-btn.delete { background: rgba(225,82,82,0.08); color: var(--rose); }
        .action-btn.reassign { background: rgba(0,194,168,0.1); color: var(--teal-deep); }
        .action-btn.solid-danger { background: var(--rose); color: #fff; }
        .action-btn.ghost { background: #fff; color: var(--slate); border-color: var(--line); }
        .rides-board tbody tr.row-link { cursor: pointer; }
        .rides-board tbody tr.row-link:focus-visible { outline: 2px solid var(--teal); outline-offset: -2px; }
        .detail-overlay { position: fixed; inset: 0; z-index: 1200; background: rgba(11,30,61,0.55); display: flex; justify-content: flex-end; }
        .detail-drawer { width: min(620px, 100%); height: 100dvh; overflow-y: auto; background: #fff; border-top: 3px solid var(--teal); box-shadow: -12px 0 40px rgba(11,30,61,0.18); }
        .detail-section { border: 1px solid var(--line); border-radius: 8px; padding: 14px; }
        .detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .detail-label { display: block; margin-bottom: 3px; color: var(--slate); font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
        .route-stop { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--line); }
        .route-stop:last-child { border-bottom: none; }
        .route-stop-number { display: grid; width: 24px; height: 24px; place-items: center; border-radius: 50%; background: var(--teal); color: #fff; font: 600 11px 'JetBrains Mono', monospace; }
        .route-stop-name { overflow: hidden; color: var(--ink); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
        .route-stop-meta { color: var(--slate); font-size: 12px; }
        .bulk-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 20px; background: rgba(0,194,168,0.08); border-bottom: 1px solid var(--line); }
        .passenger-row { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--line); }
        .passenger-row:last-child { border-bottom: none; }
        .passenger-avatar { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 50%; background: var(--ink); color: #fff; font-size: 11px; font-weight: 700; overflow: hidden; }
        .passenger-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .avail-option { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; width: 100%; padding: 12px; text-align: left; border: 1px solid var(--line); border-radius: 10px; background: #fff; cursor: pointer; transition: border-color 0.12s ease, background 0.12s ease; }
        .avail-option:hover:not(:disabled) { border-color: var(--teal); background: rgba(0,194,168,0.05); }
        .avail-option:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 560px) { .detail-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 28,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              className="mono"
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#00877A",
              }}
            >
              Admin · Rides Dispatch
            </p>
            <h1
              className="display"
              style={{
                margin: "6px 0 0",
                fontSize: "clamp(28px, 4vw, 38px)",
                fontWeight: 700,
                color: "#0B1E3D",
              }}
            >
              Rides Board
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#5A6A7A" }}>
              {loading
                ? "Loading rides board…"
                : `${totalCount} ride${totalCount === 1 ? "" : "s"} match the current filters`}
            </p>
            {!loading ? (
              <p
                className="mono"
                style={{ margin: "4px 0 0", fontSize: 11, color: "#5A6A7A" }}
              >
                {rides.length} record{rides.length === 1 ? "" : "s"} returned on
                this page
              </p>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Link href="/admin/trips" className="tab-btn inactive">
              Single Trips
            </Link>
            <Link href="/admin/rides" className="tab-btn active">
              Matched Rides
            </Link>
            <a
              href="/admin/dashboard"
              style={{
                textDecoration: "none",
                padding: "11px 18px",
                borderRadius: 10,
                color: "#0B1E3D",
                fontWeight: 600,
                fontSize: 14,
                background: "#ffffff",
                border: "1px solid #E6EAEC",
              }}
            >
              Dashboard
            </a>
            <AdminLogoutButton />
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 10,
              background: "rgba(225,82,82,0.08)",
              color: "#C13E3E",
              border: "1px solid rgba(225,82,82,0.2)",
              fontSize: 14,
            }}
          >
            {error}
          </p>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-end",
            background: "#fff",
            border: "1px solid #E6EAEC",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <label className="filter-field">
            <span>Search by</span>
            <select
              value={searchMode}
              onChange={(event) =>
                updateSearchMode(event.target.value as SearchMode)
              }
            >
              {SEARCH_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field" style={{ flex: "1 1 230px" }}>
            <span>Search value</span>
            <input
              value={searchInput}
              onChange={(event) => updateSearchInput(event.target.value)}
              inputMode="numeric"
              placeholder={
                SEARCH_MODES.find((mode) => mode.value === searchMode)
                  ?.placeholder
              }
            />
          </label>
          <div className="filter-field" style={{ minWidth: 0 }}>
            <span>Ride date</span>
            <AdminDateRangeCalendar
              dateFrom={range.dateFrom}
              dateTo={range.dateTo}
              onApply={applyDateRange}
            />
          </div>
          <label className="filter-field">
            <span>Vehicle</span>
            <select
              value={filters.vehicleType}
              onChange={(event) =>
                updateFilter("vehicleType", event.target.value)
              }
            >
              <option value="">All vehicles</option>
              {Object.entries(VEHICLES).map(([key, vehicle]) => (
                <option key={key} value={key}>
                  {vehicle.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="">All statuses</option>
              {Object.keys(STATUS_STYLES).map((status) => (
                <option key={status} value={status}>
                  {getStatusStyle(status).label ?? status}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={resetFilters}
            className="action-btn ghost"
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>

        <section
          style={{
            borderRadius: 20,
            background: "#ffffff",
            border: "1px solid #E6EAEC",
            boxShadow: "0 10px 35px rgba(11,30,61,0.05)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid #EEF2F5",
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderTop: "3px solid #00C2A8",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(0,194,168,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Route size={18} style={{ color: "#00877A" }} />
            </div>
            <div>
              <h2
                className="display"
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#0B1E3D",
                }}
              >
                All Matched Rides
              </h2>
              <p style={{ margin: "3px 0 0", color: "#5A6A7A", fontSize: 13 }}>
                View and manage multi-passenger matched rides across drivers.
              </p>
            </div>
          </div>

          {selectedIds.length > 0 ? (
            <div className="bulk-bar">
              <span style={{ color: "#0B1E3D", fontSize: 13, fontWeight: 600 }}>
                {selectedIds.length} ride{selectedIds.length === 1 ? "" : "s"}{" "}
                selected
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="action-btn ghost"
                  onClick={() => setSelectedIds([])}
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  className="action-btn solid-danger"
                  onClick={() => {
                    setPendingDeleteIds(selectedIds);
                    setDeleteError(null);
                  }}
                >
                  <Trash2 size={14} /> Delete selected
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44 }}>
                    <input
                      type="checkbox"
                      aria-label="Select every ride on this page"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      disabled={loading || rides.length === 0}
                    />
                  </th>
                  <th>Ride</th>
                  <th>Driver</th>
                  <th>Route (First → Final Station)</th>
                  <th>Date & Time</th>
                  <th>Vehicle / Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        textAlign: "center",
                        padding: 32,
                        color: "#5A6A7A",
                      }}
                    >
                      Loading rides...
                    </td>
                  </tr>
                ) : rides.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        textAlign: "center",
                        padding: 32,
                        color: "#5A6A7A",
                      }}
                    >
                      No rides matched yet. Go to Admin Dashboard to match trips
                      into a ride.
                    </td>
                  </tr>
                ) : (
                  rides.map((ride) => {
                    const st = getStatusStyle(ride.status);
                    const driverName = ride.driverId?.name ?? "Unassigned";
                    const routeStops = ride.route ?? [];
                    const firstStop =
                      routeStops[0]?.point?.address ??
                      ride.pickupStation?.name ??
                      "First station";
                    const lastStop =
                      routeStops[routeStops.length - 1]?.point?.address ??
                      ride.dropoffStation?.name ??
                      "Final station";
                    const vLabel =
                      VEHICLES[ride.vehicleType as VehicleKey]?.label ??
                      ride.vehicleType;
                    const isSelected = selectedIds.includes(ride._id);

                    return (
                      <tr
                        key={ride._id}
                        className="row-link"
                        tabIndex={0}
                        role="button"
                        aria-label={`Open details for ride ${ride.rideNumber ?? ride._id.slice(-6)}`}
                        onClick={() => openDetail(ride._id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openDetail(ride._id);
                          }
                        }}
                      >
                        <td onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select ride ${ride.rideNumber ?? ride._id.slice(-6)}`}
                            checked={isSelected}
                            onChange={() => toggleSelect(ride._id)}
                          />
                        </td>
                        <td>
                          <div>
                            <span
                              className="mono"
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#0B1E3D",
                              }}
                            >
                              Ride #{ride.rideNumber ?? ride._id.slice(-6)}
                            </span>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                color: "#5A6A7A",
                                marginTop: 2,
                              }}
                            >
                              {passengerCount(ride)} passenger
                              {passengerCount(ride) === 1 ? "" : "s"} ·{" "}
                              {ride.totalCost} EGP
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="driver-chip">
                            <div className="avatar">{initials(driverName)}</div>
                            <div>
                              <span className="name">{driverName}</span>
                              {ride.driverId?.phone && (
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: 11,
                                    color: "#5A6A7A",
                                  }}
                                >
                                  {ride.driverId.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="route-line">
                            <div className="stops">
                              <span className="addr" title={firstStop}>
                                1. {firstStop}
                              </span>
                              {routeStops.length > 2 && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: "#00877A",
                                    fontWeight: 600,
                                    paddingLeft: 12,
                                  }}
                                >
                                  + {routeStops.length - 2} intermediate
                                  station(s)
                                </span>
                              )}
                              <span className="addr" title={lastStop}>
                                {routeStops.length || "N"}. {lastStop}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#0B1E3D",
                                display: "block",
                              }}
                            >
                              {ride.date}
                            </span>
                            <span
                              className="mono"
                              style={{ fontSize: 12, color: "#5A6A7A" }}
                            >
                              {to12h(ride.startTime)} – {to12h(ride.endTime)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#0B1E3D",
                              }}
                            >
                              {vLabel}
                            </span>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                color: "#5A6A7A",
                                textTransform: "capitalize",
                              }}
                            >
                              {ride.rideType} ride
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className="status-pill"
                            style={{ background: st.bg, color: st.color }}
                          >
                            {st.label ?? ride.status}
                          </span>
                        </td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            {ride.status === "matched" ? (
                              <button
                                type="button"
                                className="action-btn reassign"
                                onClick={() => openReassign(ride)}
                                title="Reassign this ride to another availability"
                              >
                                <UserCog size={14} /> Reassign driver
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="action-btn delete"
                              onClick={() => deleteRide(ride._id)}
                              title={
                                ride.status === "completed"
                                  ? "Cannot delete a completed ride"
                                  : "Delete / cancel ride"
                              }
                              disabled={ride.status === "completed"}
                              style={
                                ride.status === "completed"
                                  ? { opacity: 0.45, cursor: "not-allowed" }
                                  : undefined
                              }
                            >
                              <Trash2 size={14} /> Cancel
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
              borderTop: "1px solid #EEF2F5",
            }}
          >
            <span style={{ fontSize: 13, color: "#5A6A7A" }}>
              Page {page} of {totalPages}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="action-btn ghost"
                disabled={loading || page <= 1}
                onClick={() => {
                  setLoading(true);
                  setPage((current) => Math.max(1, current - 1));
                }}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                type="button"
                className="action-btn ghost"
                disabled={loading || page >= totalPages}
                onClick={() => {
                  setLoading(true);
                  setPage((current) => Math.min(totalPages, current + 1));
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </section>
      </div>

      {detailId ? (
        <div
          className="detail-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDetail();
          }}
        >
          <aside
            className="detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Ride details"
          >
            <header
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                padding: "20px 24px",
                borderBottom: "1px solid #EEF2F5",
              }}
            >
              <div>
                <p
                  className="mono"
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#00877A",
                  }}
                >
                  Ride details
                </p>
                <h3
                  className="display"
                  style={{
                    margin: "5px 0 0",
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#0B1E3D",
                  }}
                >
                  {detail
                    ? `Ride #${detail.rideNumber ?? detail._id.slice(-6)}`
                    : "Loading..."}
                </h3>
                {detail ? (
                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "#5A6A7A",
                      fontSize: 13,
                    }}
                  >
                    {detail.date} · {to12h(detail.startTime)} -{" "}
                    {to12h(detail.endTime)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeDetail}
                aria-label="Close details"
                style={{
                  padding: 4,
                  color: "#5A6A7A",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </header>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                padding: 20,
              }}
            >
              {detailLoading ? (
                <p style={{ margin: 0, color: "#5A6A7A", fontSize: 14 }}>
                  Loading ride details...
                </p>
              ) : detailError ? (
                <p
                  role="alert"
                  style={{
                    margin: 0,
                    padding: "12px 14px",
                    borderRadius: 8,
                    background: "rgba(225,82,82,0.08)",
                    color: "#C13E3E",
                    border: "1px solid rgba(225,82,82,0.2)",
                    fontSize: 14,
                  }}
                >
                  {detailError}
                </p>
              ) : detail ? (
                <>
                  {detailMapPoints.length ? (
                    <section className="detail-section" style={{ padding: 12 }}>
                      <AdminTripMap key={detail._id} points={detailMapPoints} />
                      {detailGoogleMapsUrl ? (
                        <a
                          href={detailGoogleMapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="action-btn ghost"
                          style={{ marginTop: 10, textDecoration: "none" }}
                        >
                          <ExternalLink size={14} /> View in Google Maps
                        </a>
                      ) : null}
                    </section>
                  ) : (
                    <p style={{ margin: 0, color: "#5A6A7A", fontSize: 13 }}>
                      No route coordinates are available for this ride.
                    </p>
                  )}

                  <section className="detail-section">
                    <h4
                      className="display"
                      style={{
                        margin: "0 0 12px",
                        color: "#0B1E3D",
                        fontSize: 15,
                      }}
                    >
                      Ride overview
                    </h4>
                    <div className="detail-grid">
                      <div>
                        <span className="detail-label">Status</span>
                        <span
                          className="status-pill"
                          style={{
                            background: getStatusStyle(detail.status).bg,
                            color: getStatusStyle(detail.status).color,
                          }}
                        >
                          {getStatusStyle(detail.status).label ?? detail.status}
                        </span>
                      </div>
                      <div>
                        <span className="detail-label">Passengers</span>
                        <strong style={{ color: "#0B1E3D", fontSize: 14 }}>
                          {passengerCount(detail)}
                        </strong>
                      </div>
                      <div>
                        <span className="detail-label">Vehicle</span>
                        <strong style={{ color: "#0B1E3D", fontSize: 14 }}>
                          {VEHICLES[detail.vehicleType as VehicleKey]?.label ??
                            detail.vehicleType}
                        </strong>
                      </div>
                      <div>
                        <span className="detail-label">Total cost</span>
                        <strong style={{ color: "#0B1E3D", fontSize: 14 }}>
                          {detail.totalCost} EGP
                        </strong>
                      </div>
                      <div>
                        <span className="detail-label">Ride type</span>
                        <span
                          style={{
                            color: "#0B1E3D",
                            fontSize: 14,
                            textTransform: "capitalize",
                          }}
                        >
                          {detail.rideType}
                        </span>
                      </div>
                      <div>
                        <span className="detail-label">Availability</span>
                        <span style={{ color: "#0B1E3D", fontSize: 14 }}>
                          {detail.availability?.availabilityNumber != null
                            ? `#${detail.availability.availabilityNumber}`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="detail-section">
                    <h4
                      className="display"
                      style={{
                        margin: "0 0 12px",
                        color: "#0B1E3D",
                        fontSize: 15,
                      }}
                    >
                      Driver
                    </h4>
                    <div className="detail-grid">
                      <div>
                        <span className="detail-label">Name</span>
                        <span style={{ color: "#0B1E3D", fontSize: 14 }}>
                          {detail.driverId?.name ??
                            detail.assignedDriver?.name ??
                            "Unassigned"}
                        </span>
                      </div>
                      <div>
                        <span className="detail-label">Phone</span>
                        <span style={{ color: "#0B1E3D", fontSize: 14 }}>
                          {detail.driverId?.phone ??
                            detail.assignedDriver?.phone ??
                            "—"}
                        </span>
                      </div>
                      <div>
                        <span className="detail-label">Vehicle</span>
                        <span style={{ color: "#0B1E3D", fontSize: 14 }}>
                          {[
                            detail.assignedDriver?.carBrand,
                            detail.assignedDriver?.carModel,
                          ]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="detail-label">Plate</span>
                        <span
                          className="mono"
                          style={{ color: "#0B1E3D", fontSize: 14 }}
                        >
                          {detail.assignedDriver?.plate ?? "—"}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="detail-section">
                    <h4
                      className="display"
                      style={{
                        margin: "0 0 4px",
                        color: "#0B1E3D",
                        fontSize: 15,
                      }}
                    >
                      Passengers
                    </h4>
                    <p
                      style={{
                        margin: "0 0 8px",
                        color: "#5A6A7A",
                        fontSize: 12,
                      }}
                    >
                      Each passenger is listed once with their boarding and
                      alighting order.
                    </p>
                    {passengerActionError ? (
                      <p
                        role="alert"
                        style={{
                          margin: "0 0 8px",
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "rgba(231,76,60,0.08)",
                          color: "#C0392B",
                          fontSize: 12,
                        }}
                      >
                        {passengerActionError}
                      </p>
                    ) : null}
                    {detail.passengerDetails?.length ? (
                      detail.passengerDetails.map((passenger) => {
                        const isNoShow = passenger.status === "no_show";
                        const isBusy =
                          passengerActionTripId === passenger.tripId;
                        return (
                          <div
                            className="passenger-row"
                            key={passenger.userId}
                            style={
                              isNoShow
                                ? {
                                    background: "rgba(231,76,60,0.06)",
                                    borderRadius: 10,
                                  }
                                : undefined
                            }
                          >
                            <span className="passenger-avatar">
                              {passenger.user?.profilePic ? (
                                <img src={passenger.user.profilePic} alt="" />
                              ) : (
                                initials(passenger.user?.name)
                              )}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <strong
                                style={{
                                  display: "block",
                                  overflow: "hidden",
                                  color: isNoShow ? "#C0392B" : "#0B1E3D",
                                  fontSize: 13,
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {passenger.user?.name ?? "Unknown passenger"}
                              </strong>
                              <span style={{ color: "#5A6A7A", fontSize: 12 }}>
                                {passenger.user?.userNumber != null
                                  ? `User #${passenger.user.userNumber}`
                                  : "User number unavailable"}
                                {passenger.user?.phone
                                  ? ` · ${passenger.user.phone}`
                                  : ""}
                              </span>
                              {isNoShow ? (
                                <span
                                  style={{
                                    display: "block",
                                    color: "#C0392B",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    marginTop: 2,
                                  }}
                                >
                                  No show
                                </span>
                              ) : null}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                gap: 6,
                              }}
                            >
                              <span
                                className="mono"
                                style={{
                                  color: "#5A6A7A",
                                  fontSize: 11,
                                  textAlign: "right",
                                }}
                              >
                                Board {passenger.pickupOrder ?? "—"}
                                <br />
                                Alight {passenger.dropoffOrder ?? "—"}
                              </span>
                              {passenger.tripId ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    markPassengerStatus(
                                      passenger.tripId as string,
                                      isNoShow ? "waiting" : "no_show",
                                    )
                                  }
                                  style={{
                                    padding: "4px 10px",
                                    borderRadius: 999,
                                    border: isNoShow
                                      ? "1px solid #27AE60"
                                      : "1px solid rgba(231,76,60,0.35)",
                                    background: "#fff",
                                    color: isNoShow ? "#196F3D" : "#C0392B",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: isBusy ? "not-allowed" : "pointer",
                                    opacity: isBusy ? 0.6 : 1,
                                  }}
                                >
                                  {isBusy
                                    ? "Saving..."
                                    : isNoShow
                                      ? "Restore"
                                      : "Mark no-show"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p
                        style={{
                          margin: "8px 0 0",
                          color: "#5A6A7A",
                          fontSize: 13,
                        }}
                      >
                        No passenger records have been captured for this ride.
                      </p>
                    )}
                  </section>

                  <section className="detail-section">
                    <h4
                      className="display"
                      style={{
                        margin: "0 0 4px",
                        color: "#0B1E3D",
                        fontSize: 15,
                      }}
                    >
                      Ordered route
                    </h4>
                    <p
                      style={{
                        margin: "0 0 8px",
                        color: "#5A6A7A",
                        fontSize: 12,
                      }}
                    >
                      Stops are shown in dispatch order.
                    </p>
                    {(detail.route ?? []).map((stop, index) => (
                      <div
                        className="route-stop"
                        key={`${detail._id}-stop-${index}`}
                      >
                        <span className="route-stop-number">{index + 1}</span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            className="route-stop-name"
                            title={stop.point?.address}
                          >
                            {stop.point?.address ?? "Route stop"}
                          </div>
                          <div className="route-stop-meta">
                            {stop.arrival || stop.departure
                              ? `${to12h(stop.arrival ?? stop.departure ?? "")} `
                              : ""}
                            Boarding{" "}
                            {stop.boardingNumber ?? stop.boarding?.length ?? 0}{" "}
                            · Alighting{" "}
                            {stop.alightingNumber ??
                              stop.alighting?.length ??
                              0}
                          </div>
                        </div>
                        <span
                          className="mono"
                          style={{ color: "#5A6A7A", fontSize: 12 }}
                        >
                          {stop.waitingMinutes
                            ? `${stop.waitingMinutes} min`
                            : ""}
                        </span>
                      </div>
                    ))}
                    {detail.route?.length ? null : (
                      <p
                        style={{
                          margin: "8px 0 0",
                          color: "#5A6A7A",
                          fontSize: 13,
                        }}
                      >
                        No route stops have been recorded.
                      </p>
                    )}
                  </section>
                </>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      {reassignRide ? (
        <div
          className="detail-overlay"
          style={{
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !reassigningId)
              closeReassign();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Reassign driver"
            style={{
              display: "flex",
              flexDirection: "column",
              width: "min(620px, 100%)",
              maxHeight: "min(80dvh, 720px)",
              borderRadius: 14,
              borderTop: "3px solid #00C2A8",
              background: "#fff",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                padding: "18px 20px",
                borderBottom: "1px solid #EEF2F5",
              }}
            >
              <div>
                <p
                  className="mono"
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#00877A",
                  }}
                >
                  Reassign driver
                </p>
                <h3
                  className="display"
                  style={{
                    margin: "5px 0 0",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#0B1E3D",
                  }}
                >
                  Ride #{reassignRide.rideNumber ?? reassignRide._id.slice(-6)}
                </h3>
                <p
                  style={{ margin: "4px 0 0", color: "#5A6A7A", fontSize: 13 }}
                >
                  Availabilities on {reassignRide.date}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReassign}
                aria-label="Close reassign dialog"
                disabled={Boolean(reassigningId)}
                style={{
                  padding: 4,
                  color: "#5A6A7A",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </header>

            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid #EEF2F5",
              }}
            >
              <label className="filter-field" style={{ minWidth: 0 }}>
                <span>Search availabilities</span>
                <input
                  autoFocus
                  value={availSearch}
                  onChange={(event) => setAvailSearch(event.target.value)}
                  placeholder="Driver name, phone, number, time or address"
                />
              </label>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 16,
                overflowY: "auto",
              }}
            >
              {reassignError ? (
                <p
                  role="alert"
                  style={{
                    margin: 0,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "rgba(225,82,82,0.08)",
                    color: "#C13E3E",
                    border: "1px solid rgba(225,82,82,0.2)",
                    fontSize: 13,
                  }}
                >
                  {reassignError}
                </p>
              ) : null}
              {availLoading ? (
                <p style={{ margin: 0, color: "#5A6A7A", fontSize: 14 }}>
                  Loading availabilities…
                </p>
              ) : filteredAvailabilities.length === 0 ? (
                <p style={{ margin: 0, color: "#5A6A7A", fontSize: 14 }}>
                  No availability found for {reassignRide.date}. Create one from
                  the Availability page.
                </p>
              ) : (
                filteredAvailabilities.map((option) => (
                  <button
                    key={option._id}
                    type="button"
                    className="avail-option"
                    disabled={Boolean(reassigningId)}
                    onClick={() => void confirmReassign(option._id)}
                  >
                    <span style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          display: "block",
                          color: "#0B1E3D",
                          fontSize: 14,
                        }}
                      >
                        {option.driverId?.name ?? "Unknown driver"}
                        <span
                          className="mono"
                          style={{
                            marginLeft: 8,
                            color: "#00877A",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          #{option.availabilityNumber ?? option._id.slice(-6)}
                        </span>
                      </strong>
                      <span
                        style={{
                          display: "block",
                          marginTop: 2,
                          color: "#5A6A7A",
                          fontSize: 12,
                        }}
                      >
                        {option.driverId?.phone ?? "No phone"} ·{" "}
                        {to12h(option.startTime ?? "")} –{" "}
                        {to12h(option.endTime ?? "")} ·{" "}
                        {option.status ?? "open"}
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: 4,
                          overflow: "hidden",
                          color: "#5A6A7A",
                          fontSize: 12,
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <MapPin size={11} style={{ verticalAlign: "-1px" }} />{" "}
                        {option.startLocation?.address ?? "—"} →{" "}
                        {option.endLocation?.address ?? "—"}
                      </span>
                    </span>
                    <span
                      style={{
                        color: "#00877A",
                        fontSize: 13,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {reassigningId === option._id ? "Assigning…" : "Select"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeleteIds ? (
        <div
          className="detail-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setPendingDeleteIds(null);
              setPassword("");
              setDeleteError(null);
            }
          }}
          style={{
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <form
            className="detail-section"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm selected ride deletion"
            style={{
              width: "min(420px, 100%)",
              background: "#fff",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
            onSubmit={(event) => {
              event.preventDefault();
              void deleteSelectedRides();
            }}
          >
            <h3
              className="display"
              style={{ margin: 0, color: "#0B1E3D", fontSize: 18 }}
            >
              Delete selected rides
            </h3>
            <p style={{ margin: "6px 0 16px", color: "#5A6A7A", fontSize: 13 }}>
              This cancels {pendingDeleteIds.length} ride
              {pendingDeleteIds.length === 1 ? "" : "s"} and unassigns their
              trips. Enter the admin password to confirm.
            </p>
            <label className="filter-field" style={{ minWidth: 0 }}>
              <span>Admin password</span>
              <input
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {deleteError ? (
              <p
                role="alert"
                style={{ margin: "12px 0 0", color: "#C13E3E", fontSize: 13 }}
              >
                {deleteError}
              </p>
            ) : null}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 18,
              }}
            >
              <button
                type="button"
                className="action-btn ghost"
                disabled={deleting}
                onClick={() => {
                  setPendingDeleteIds(null);
                  setPassword("");
                  setDeleteError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="action-btn solid-danger"
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete selected"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
