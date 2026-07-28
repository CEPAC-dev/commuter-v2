"use client";

import { useEffect, useState } from "react";
import { Route, Trash2, UserPlus, X, MapPin, Inbox } from "lucide-react";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";

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
  pickup?: { address?: string } | null;
  dropoff?: { address?: string } | null;
  status: string;
  driverId?: { _id?: string; name?: string; phone?: string } | null;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label?: string }> = {
  scheduled: { bg: "rgba(0,194,168,0.12)", color: "#00877A" },
  confirmed: { bg: "rgba(0,194,168,0.12)", color: "#00877A" },
  in_progress: { bg: "rgba(232,163,61,0.16)", color: "#B4790C", label: "In progress" },
  active: { bg: "rgba(232,163,61,0.16)", color: "#B4790C" },
  completed: { bg: "rgba(90,106,122,0.12)", color: "#4A5A6A" },
  cancelled: { bg: "rgba(225,82,82,0.12)", color: "#C13E3E" },
};

function getStatusStyle(status: string) {
  const key = status?.toLowerCase().replace(/\s+/g, "_") ?? "";
  return STATUS_STYLES[key] ?? { bg: "rgba(90,106,122,0.1)", color: "#5A6A7A" };
}

function initials(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default function AdminTripsPage() {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalTripId, setModalTripId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  async function loadTrips() {
    try {
      const res = await fetch("/api/admin/trips");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load trips");
      setTrips(data.trips ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trips");
    } finally {
      setLoading(false);
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
      await loadTrips();
    } catch (err) {
      setDriversError(err instanceof Error ? err.message : "Failed to assign driver");
      setAssigningId(null);
    }
  }

  async function deleteTrip(id: string) {
    const confirmed = window.confirm("Delete this trip? This can't be undone.");
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/trips/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete trip");
      setTrips((current) => current.filter((trip) => trip._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete trip");
    }
  }

  useEffect(() => {
    if (!modalTripId) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [modalTripId]);

  useEffect(() => {
    let active = true;

    const runLoad = async () => {
      try {
        const res = await fetch("/api/admin/trips");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load trips");
        if (active) setTrips(data.trips ?? []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load trips");
      } finally {
        if (active) setLoading(false);
      }
    };

    void runLoad();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="trips-board">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');

        .trips-board {
          --ink: #0B1E3D;
          --teal: #00C2A8;
          --teal-deep: #00877A;
          --amber: #E8A33D;
          --rose: #E15252;
          --slate: #5A6A7A;
          --line: #E6EAEC;
          --canvas: #F6F8F7;
          --surface: #FFFFFF;
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
          padding: 12px 16px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--slate);
          border-bottom: 1px solid var(--line);
        }
        .trips-board tbody tr {
          border-bottom: 1px solid var(--line);
          transition: background 0.12s ease;
        }
        .trips-board tbody tr:hover { background: rgba(0,194,168,0.035); }
        .trips-board tbody tr:last-child { border-bottom: none; }
        .trips-board td { padding: 16px; vertical-align: middle; }

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
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .route-line .rail {
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 36px;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .route-line .dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--teal);
          flex-shrink: 0;
        }
        .route-line .dot.end { background: var(--ink); }
        .route-line .dash {
          width: 1px;
          flex: 1;
          background-image: linear-gradient(var(--slate) 55%, transparent 45%);
          background-size: 1px 6px;
          opacity: 0.5;
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
          transition: opacity 0.12s ease;
        }
        .action-btn:hover { opacity: 0.75; }
        .action-btn.assign { background: rgba(0,194,168,0.1); color: var(--teal-deep); }
        .action-btn.delete { background: rgba(225,82,82,0.08); color: var(--rose); }

        .skeleton-row td { padding: 16px; }
        .skeleton-bar {
          height: 12px;
          border-radius: 4px;
          background: linear-gradient(90deg, var(--line) 25%, #EEF1F2 37%, var(--line) 63%);
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
          background: rgba(11,30,61,0.55);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          z-index: 1200;
          animation: fadeIn 0.15s ease;
        }
        .modal-panel {
          width: 100%; max-width: 460px;
          background: #ffffff;
          border-radius: 18px;
          padding: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.25);
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
          border: 1px solid #E6EAEC; border-radius: 12px; padding: 11px 13px;
          background: #F6F8F7; cursor: pointer; text-align: left; width: 100%;
          transition: border-color 0.12s ease, background 0.12s ease;
        }
        .driver-row:hover:not(:disabled) { border-color: #00C2A8; background: rgba(0,194,168,0.05); }
        .driver-row:disabled { cursor: default; opacity: 0.6; }
        .avail-chip {
          font-size: 11px; font-weight: 600;
          color: #5A6A7A; background: #EEF2F5;
          padding: 3px 8px; border-radius: 999px;
          margin-top: 3px; display: inline-block;
        }
        .spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(0,194,168,0.25);
          border-top-color: #00877A;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .modal-skel { display: flex; align-items: center; gap: 10px; padding: 11px 13px; }
      `}</style>

      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, gap: 12, flexWrap: "wrap" }}>
          <div>
            <p className="mono" style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#00877A" }}>
              Admin · Dispatch
            </p>
            <h1 className="display" style={{ margin: "6px 0 0", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, color: "#0B1E3D" }}>
              Trips
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#5A6A7A" }}>
              {loading ? "Loading the board…" : `${trips.length} trip${trips.length === 1 ? "" : "s"} on the board`}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <a
              href="/admin/dashboard"
              style={{ textDecoration: "none", padding: "11px 18px", borderRadius: 10, color: "#0B1E3D", fontWeight: 600, fontSize: 14, background: "#ffffff", border: "1px solid #E6EAEC" }}
            >
              Back to dashboard
            </a>
            <AdminLogoutButton />
          </div>
        </div>

        {error ? (
          <p role="alert" style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(225,82,82,0.08)", color: "#C13E3E", border: "1px solid rgba(225,82,82,0.2)", fontSize: 14 }}>
            {error}
          </p>
        ) : null}

        <section style={{ borderRadius: 20, background: "#ffffff", border: "1px solid #E6EAEC", boxShadow: "0 10px 35px rgba(11,30,61,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid #EEF2F5", display: "flex", alignItems: "center", gap: 12, borderTop: "3px solid #00C2A8" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(0,194,168,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Route size={18} style={{ color: "#00877A" }} />
            </div>
            <div>
              <h2 className="display" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0B1E3D" }}>Manage trips</h2>
              <p style={{ margin: "3px 0 0", color: "#5A6A7A", fontSize: 13 }}>Assign a driver or remove a trip from the schedule.</p>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Trip</th>
                  <th>Route</th>
                  <th>Date / Time</th>
                  <th>Status</th>
                  <th>Driver</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="skeleton-row">
                      <td><div className="skeleton-bar" style={{ width: 48 }} /></td>
                      <td><div className="skeleton-bar" style={{ width: 160 }} /></td>
                      <td><div className="skeleton-bar" style={{ width: 100 }} /></td>
                      <td><div className="skeleton-bar" style={{ width: 70 }} /></td>
                      <td><div className="skeleton-bar" style={{ width: 90 }} /></td>
                      <td><div className="skeleton-bar" style={{ width: 120 }} /></td>
                    </tr>
                  ))
                ) : trips.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "56px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
                        <Inbox size={28} style={{ color: "#C7D0D4" }} />
                        <p style={{ margin: 0, fontWeight: 600, color: "#0B1E3D", fontSize: 15 }}>No trips on the board</p>
                        <p style={{ margin: 0, color: "#5A6A7A", fontSize: 13 }}>New trips will show up here once they're scheduled.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  trips.map((trip, index) => {
                    const statusStyle = getStatusStyle(trip.status);
                    const driverName = trip.driverId?.name;
                    return (
                      <tr key={trip._id ? `${trip._id}-${index}` : `trip-${index}`}>
                        <td>
                          <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D" }}>
                            {trip.tripNumber != null ? `#${String(trip.tripNumber).padStart(3, "0")}` : `#${String(trip._id).slice(-6)}`}
                          </span>
                        </td>
                        <td>
                          <div className="route-line">
                            <div className="rail">
                              <span className="dot" />
                              <span className="dash" />
                              <span className="dot end" />
                            </div>
                            <div className="stops">
                              <span className="addr" title={trip.pickup?.address ?? undefined}>
                                {trip.pickup?.address ?? "No pickup set"}
                              </span>
                              <span className="addr" title={trip.dropoff?.address ?? undefined} style={{ color: "#5A6A7A" }}>
                                {trip.dropoff?.address ?? "No dropoff set"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13, color: "#0B1E3D", fontWeight: 500 }}>{trip.date}</div>
                          <div className="mono" style={{ fontSize: 12, color: "#5A6A7A", marginTop: 2 }}>{trip.pickupTime}</div>
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
                        <td>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" onClick={() => void openAssignModal(trip._id)} className="action-btn assign">
                              <UserPlus size={14} /> Assign driver
                            </button>
                            <button type="button" onClick={() => void deleteTrip(trip._id)} className="action-btn delete">
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
        </section>
      </div>

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
                <h3 className="display" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0B1E3D" }}>Assign driver</h3>
                {(() => {
                  const trip = trips.find((t) => t._id === modalTripId);
                  return trip ? (
                    <p style={{ margin: "3px 0 0", fontSize: 13, color: "#5A6A7A" }}>
                      {trip.tripNumber != null ? `#${String(trip.tripNumber).padStart(3, "0")}` : ""} · {trip.date} · {trip.pickupTime}
                    </p>
                  ) : null;
                })()}
              </div>
              <button type="button" onClick={closeModal} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: "#5A6A7A", padding: 4, flexShrink: 0 }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: "6px 0 16px", fontSize: 13, color: "#5A6A7A" }}>
              Showing drivers available for this trip's date and time.
            </p>

            {driversError ? (
              <p role="alert" style={{ margin: "0 0 14px", padding: "10px 12px", borderRadius: 10, background: "rgba(225,82,82,0.08)", color: "#C13E3E", border: "1px solid rgba(225,82,82,0.2)", fontSize: 13 }}>
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
                <MapPin size={22} style={{ color: "#C7D0D4" }} />
                <p style={{ margin: 0, fontSize: 14, color: "#5A6A7A" }}>No drivers are available for this trip's date.</p>
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
                        <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#0B1E3D", color: "#fff", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {initials(driver.name)}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <strong style={{ color: "#0B1E3D", fontSize: 14, display: "block" }}>{driver.name ?? "Driver"}</strong>
                          <span style={{ color: "#5A6A7A", fontSize: 12.5 }}>{driver.phone ?? "No phone on file"}</span>
                          {driver.startTime && driver.endTime ? (
                            <span className="mono avail-chip">{driver.startTime}–{driver.endTime}</span>
                          ) : null}
                        </span>
                      </span>
                      <span style={{ color: "#00877A", fontWeight: 700, fontSize: 13, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
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