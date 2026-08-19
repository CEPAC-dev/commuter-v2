"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, MapPin, Plus, Trash2, X } from "lucide-react";
import AddressInput from "@/components/landing/AddressInput";
import AdminTripMap, { type TripMapPoint } from "@/components/admin/AdminTripMap";
import type { TripPoint } from "@/lib/store/useTripStore";

interface AvailabilityRecord {
  _id: string;
  driver?: {
    userNumber?: number;
    name?: string;
    phone?: string;
    carType?: string;
  } | null;
  date?: string;
  startTime?: string;
  endTime?: string;
}

interface AvailabilityDetail {
  _id: string;
  availabilityNumber?: number;
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  matched?: boolean;
  startLocation?: { address?: string; lat?: number; lng?: number };
  endLocation?: { address?: string; lat?: number; lng?: number };
  startNearestStation?: { name?: string; lat?: number; lng?: number };
  endNearestStation?: { name?: string; lat?: number; lng?: number };
  driverId?: { name?: string; phone?: string; email?: string } | null;
}

interface DriverOption {
  _id: string;
  name: string;
  phone: string;
  userNumber: number | null;
  carType: string;
}

const CAR_TYPE_LABELS: Record<string, string> = {
  private: "Private car",
  taxi: "Taxi",
  van: "Van",
  microbus: "Microbus",
};

function detailPoints(detail: AvailabilityDetail): TripMapPoint[] {
  const candidates: Array<{
    point?: { address?: string; name?: string; lat?: number; lng?: number };
    label: string;
    kind: TripMapPoint["kind"];
  }> = [
    { point: detail.startLocation, label: "Start location", kind: "pickup" },
    { point: detail.startNearestStation, label: "Nearest station to start", kind: "station" },
    { point: detail.endNearestStation, label: "Nearest station to end", kind: "station" },
    { point: detail.endLocation, label: "End location", kind: "dropoff" },
  ];

  const points: TripMapPoint[] = [];
  for (const candidate of candidates) {
    const lat = candidate.point?.lat;
    const lng = candidate.point?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    points.push({
      lat,
      lng,
      label: `${candidate.label}: ${candidate.point?.address ?? candidate.point?.name ?? "—"}`,
      kind: candidate.kind,
      order: points.length + 1,
    });
  }
  return points;
}

export default function AdminAvailabilityTable({ initialRecords }: { initialRecords: AvailabilityRecord[] }) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AvailabilityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [driverId, setDriverId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [startLocation, setStartLocation] = useState<TripPoint | null>(null);
  const [endLocation, setEndLocation] = useState<TripPoint | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const mapPoints = useMemo(() => (detail ? detailPoints(detail) : []), [detail]);

  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  useEffect(() => {
    if (!detailId) return;
    let active = true;

    const load = async () => {
      try {
        const res = await fetch(`/api/admin/availability/${detailId}`);
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          data?: AvailabilityDetail;
        } | null;
        if (!res.ok) {
          throw new Error(data?.error ?? `Failed to load availability (HTTP ${res.status})`);
        }
        if (!active) return;
        setDetail(data?.data ?? null);
        setDetailError(null);
      } catch (err) {
        if (!active) return;
        setDetailError(err instanceof Error ? err.message : "Failed to load availability");
      } finally {
        if (active) setDetailLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [detailId]);

  useEffect(() => {
    if (!createOpen || drivers.length) return;
    let active = true;

    const load = async () => {
      try {
        const res = await fetch("/api/admin/drivers");
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          drivers?: DriverOption[];
        } | null;
        if (!res.ok) throw new Error(data?.error ?? "Failed to load drivers");
        if (!active) return;
        setDrivers(data?.drivers ?? []);
      } catch (err) {
        if (!active) return;
        setCreateError(err instanceof Error ? err.message : "Failed to load drivers");
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [createOpen, drivers.length]);

  function openDetail(id: string) {
    setDetailId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
  }

  function closeDetail() {
    setDetailId(null);
    setDetail(null);
    setDetailError(null);
  }

  function closeCreate() {
    setCreateOpen(false);
    setCreateError(null);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!driverId || !date || !startTime || !endTime || !startLocation || !endLocation) {
      setCreateError("All fields are required.");
      return;
    }
    if (startTime >= endTime) {
      setCreateError("End time must be after start time.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId, date, startTime, endTime, startLocation, endLocation }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not create availability.");
      setDriverId("");
      setDate("");
      setStartTime("");
      setEndTime("");
      setStartLocation(null);
      setEndLocation(null);
      closeCreate();
      router.refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create availability.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/availability/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Unable to delete availability.");
        return;
      }
      setRecords((current) => current.filter((record) => record._id !== id));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section style={{ borderRadius: 24, background: "#ffffff", border: "1px solid #e8edf0", boxShadow: "0 10px 35px rgba(11,30,61,0.05)", overflow: "hidden" }}>
      <style>{`
        .avail-row { cursor: pointer; }
        .avail-row:hover { background: rgba(0,194,168,0.04); }
        .avail-overlay { position: fixed; inset: 0; z-index: 1200; background: rgba(11,30,61,0.55); display: flex; }
        .avail-field { display: flex; flex-direction: column; gap: 6px; }
        .avail-field > span { color: #5A6A7A; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
        .avail-field input, .avail-field select { min-height: 40px; border: 1px solid #E6EAEC; border-radius: 8px; padding: 8px 10px; color: #0B1E3D; background: #fff; font: 600 14px inherit; }
        .avail-field input:focus, .avail-field select:focus { outline: 2px solid rgba(0,194,168,0.3); border-color: #00C2A8; }
        .avail-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 8px; border: 1px solid transparent; font-size: 13px; font-weight: 600; cursor: pointer; }
        .avail-btn.primary { background: #00C2A8; color: #fff; }
        .avail-btn.ghost { background: #fff; color: #5A6A7A; border-color: #E6EAEC; }
        .avail-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .avail-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .avail-detail-label { display: block; margin-bottom: 3px; color: #5A6A7A; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
        @media (max-width: 560px) { .avail-detail-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ padding: "18px 24px", borderBottom: "1px solid #eef2f5", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(245,166,35,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CalendarClock size={20} style={{ color: "#F5A623" }} />
        </div>
        <div style={{ flex: "1 1 240px" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0B1E3D" }}>Driver availability records</h2>
          <p style={{ margin: "4px 0 0", color: "#5A6A7A", fontSize: 14 }}>Click a record to view its details, or delete it directly.</p>
        </div>
        <button type="button" className="avail-btn primary" onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> Add new availability
        </button>
      </div>
      {error ? <p role="alert" style={{ margin: "16px 24px 0", padding: "10px 12px", borderRadius: 10, background: "rgba(231,76,60,0.08)", color: "#e74c3c", border: "1px solid rgba(231,76,60,0.2)" }}>{error}</p> : null}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f8f9fa" }}>
            <tr>
              <th style={{ textAlign: "left", padding: "14px 16px", color: "#0B1E3D", fontSize: 13 }}>Driver ID</th>
              <th style={{ textAlign: "left", padding: "14px 16px", color: "#0B1E3D", fontSize: 13 }}>Driver Name</th>
              <th style={{ textAlign: "left", padding: "14px 16px", color: "#0B1E3D", fontSize: 13 }}>Date</th>
              <th style={{ textAlign: "left", padding: "14px 16px", color: "#0B1E3D", fontSize: 13 }}>Car type</th>
              <th style={{ textAlign: "left", padding: "14px 16px", color: "#0B1E3D", fontSize: 13 }}>Window</th>
              <th style={{ textAlign: "left", padding: "14px 16px", color: "#0B1E3D", fontSize: 13 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr
                key={record._id}
                className="avail-row"
                tabIndex={0}
                role="button"
                aria-label={`Open availability details for ${record.driver?.name ?? "driver"}`}
                onClick={() => openDetail(record._id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openDetail(record._id);
                  }
                }}
                style={{ borderTop: "1px solid #eef2f5" }}
              >
                <td style={{ padding: "14px 16px", color: "#0B1E3D", fontWeight: 600 }}>{record.driver?.userNumber ? `#${record.driver.userNumber}` : "—"}</td>
                <td style={{ padding: "14px 16px", color: "#5A6A7A" }}>{record.driver?.name ?? "—"}</td>
                <td style={{ padding: "14px 16px", color: "#5A6A7A" }}>{record.date ?? "—"}</td>
                <td style={{ padding: "14px 16px", color: "#5A6A7A" }}>{CAR_TYPE_LABELS[record.driver?.carType ?? ""] ?? "—"}</td>
                <td style={{ padding: "14px 16px", color: "#5A6A7A" }}>{record.startTime ?? "—"} → {record.endTime ?? "—"}</td>
                <td style={{ padding: "14px 16px" }} onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleDelete(record._id)}
                    disabled={deletingId === record._id}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(231,76,60,0.25)", background: "transparent", color: "#e74c3c", cursor: deletingId === record._id ? "not-allowed" : "pointer", fontWeight: 700 }}
                  >
                    <Trash2 size={14} /> {deletingId === record._id ? "Deleting..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailId ? (
        <div
          className="avail-overlay"
          style={{ justifyContent: "flex-end" }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDetail();
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Availability details"
            style={{ width: "min(560px, 100%)", height: "100dvh", overflowY: "auto", background: "#fff", borderTop: "3px solid #00C2A8", boxShadow: "-12px 0 40px rgba(11,30,61,0.18)" }}
          >
            <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "20px 24px", borderBottom: "1px solid #EEF2F5" }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#00877A" }}>Availability details</p>
                <h3 style={{ margin: "5px 0 0", fontSize: 20, fontWeight: 700, color: "#0B1E3D" }}>
                  {detail ? `Availability #${detail.availabilityNumber ?? detail._id.slice(-6)}` : "Loading..."}
                </h3>
                {detail ? <p style={{ margin: "4px 0 0", color: "#5A6A7A", fontSize: 13 }}>{detail.date} · {detail.startTime} → {detail.endTime}</p> : null}
              </div>
              <button type="button" onClick={closeDetail} aria-label="Close details" style={{ padding: 4, color: "#5A6A7A", background: "transparent", border: "none", cursor: "pointer" }}><X size={20} /></button>
            </header>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 20 }}>
              {detailLoading ? (
                <p style={{ margin: 0, color: "#5A6A7A", fontSize: 14 }}>Loading availability details...</p>
              ) : detailError ? (
                <p role="alert" style={{ margin: 0, padding: "12px 14px", borderRadius: 8, background: "rgba(225,82,82,0.08)", color: "#C13E3E", border: "1px solid rgba(225,82,82,0.2)", fontSize: 14 }}>{detailError}</p>
              ) : detail ? (
                <>
                  {mapPoints.length ? (
                    <div style={{ border: "1px solid #E6EAEC", borderRadius: 8, padding: 12 }}>
                      <AdminTripMap key={detail._id} points={mapPoints} />
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: "#5A6A7A", fontSize: 13 }}>No coordinates recorded for this availability.</p>
                  )}

                  <section style={{ border: "1px solid #E6EAEC", borderRadius: 8, padding: 14 }}>
                    <h4 style={{ margin: "0 0 12px", color: "#0B1E3D", fontSize: 15 }}>Driver</h4>
                    <div className="avail-detail-grid">
                      <div><span className="avail-detail-label">Name</span><span style={{ color: "#0B1E3D", fontSize: 14 }}>{detail.driverId?.name ?? "—"}</span></div>
                      <div><span className="avail-detail-label">Phone</span><span style={{ color: "#0B1E3D", fontSize: 14 }}>{detail.driverId?.phone ?? "—"}</span></div>
                      <div><span className="avail-detail-label">Status</span><span style={{ color: "#0B1E3D", fontSize: 14, textTransform: "capitalize" }}>{detail.status ?? "—"}</span></div>
                      <div><span className="avail-detail-label">Matched</span><span style={{ color: "#0B1E3D", fontSize: 14 }}>{detail.matched ? "Yes" : "No"}</span></div>
                    </div>
                  </section>

                  <section style={{ border: "1px solid #E6EAEC", borderRadius: 8, padding: 14 }}>
                    <h4 style={{ margin: "0 0 12px", color: "#0B1E3D", fontSize: 15 }}>Locations</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div><span className="avail-detail-label">Start location</span><span style={{ color: "#0B1E3D", fontSize: 13 }}><MapPin size={12} style={{ verticalAlign: "-1px", color: "#00C2A8" }} /> {detail.startLocation?.address ?? "—"}</span></div>
                      <div><span className="avail-detail-label">Nearest station to start</span><span style={{ color: "#0B1E3D", fontSize: 13 }}>{detail.startNearestStation?.name ?? "—"}</span></div>
                      <div><span className="avail-detail-label">End location</span><span style={{ color: "#0B1E3D", fontSize: 13 }}><MapPin size={12} style={{ verticalAlign: "-1px", color: "#0B1E3D" }} /> {detail.endLocation?.address ?? "—"}</span></div>
                      <div><span className="avail-detail-label">Nearest station to end</span><span style={{ color: "#0B1E3D", fontSize: 13 }}>{detail.endNearestStation?.name ?? "—"}</span></div>
                    </div>
                  </section>
                </>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      {createOpen ? (
        <div
          className="avail-overlay"
          style={{ alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !creating) closeCreate();
          }}
        >
          <form
            onSubmit={handleCreate}
            role="dialog"
            aria-modal="true"
            aria-label="Add new availability"
            style={{ display: "flex", flexDirection: "column", gap: 14, width: "min(540px, 100%)", maxHeight: "min(88dvh, 760px)", overflowY: "auto", padding: 20, borderRadius: 14, borderTop: "3px solid #F5A623", background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0B1E3D" }}>Add new availability</h3>
                <p style={{ margin: "4px 0 0", color: "#5A6A7A", fontSize: 13 }}>Assign a driver a new availability window.</p>
              </div>
              <button type="button" onClick={closeCreate} aria-label="Close" disabled={creating} style={{ padding: 4, color: "#5A6A7A", background: "transparent", border: "none", cursor: "pointer" }}><X size={20} /></button>
            </div>

            <label className="avail-field">
              <span>Driver</span>
              <select value={driverId} onChange={(event) => setDriverId(event.target.value)} required>
                <option value="">Select a driver</option>
                {drivers.map((driver) => (
                  <option key={driver._id} value={driver._id}>
                    {driver.userNumber ? `#${driver.userNumber} · ` : ""}{driver.name || driver.phone}
                    {driver.carType ? ` · ${CAR_TYPE_LABELS[driver.carType] ?? driver.carType}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="avail-field">
              <span>Date</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="avail-field">
                <span>Start time</span>
                <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
              </label>
              <label className="avail-field">
                <span>End time</span>
                <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
              </label>
            </div>

            <div className="avail-field">
              <span>Start location</span>
              <AddressInput id="avail-start" placeholder="Search start address" value={startLocation} onChange={setStartLocation} />
            </div>

            <div className="avail-field">
              <span>End location</span>
              <AddressInput id="avail-end" placeholder="Search end address" value={endLocation} onChange={setEndLocation} iconColor="#0B1E3D" />
            </div>

            {createError ? <p role="alert" style={{ margin: 0, color: "#C13E3E", fontSize: 13 }}>{createError}</p> : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="avail-btn ghost" onClick={closeCreate} disabled={creating}>Cancel</button>
              <button type="submit" className="avail-btn primary" disabled={creating}>{creating ? "Creating..." : "Create availability"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
