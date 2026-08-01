"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Route, Trash2, MapPin, Clock, CalendarDays, Users, Car } from "lucide-react";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import { VEHICLES, type VehicleKey } from "@/lib/config/vehicles";

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
  driverId?: { _id?: string; name?: string; phone?: string; email?: string } | null;
  passengers?: any[];
  route?: Array<{ point?: { address?: string; lat?: number; lng?: number }; boarding?: number; alighting?: number; waitingMinutes?: number }>;
  pickupStation?: { name?: string };
  dropoffStation?: { name?: string };
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label?: string }> = {
  matched: { bg: "rgba(0,194,168,0.12)", color: "#00877A", label: "Matched" },
  confirmed: { bg: "rgba(0,194,168,0.12)", color: "#00877A", label: "Confirmed" },
  active: { bg: "rgba(232,163,61,0.16)", color: "#B4790C", label: "Active" },
  completed: { bg: "rgba(90,106,122,0.12)", color: "#4A5A6A", label: "Completed" },
  cancelled: { bg: "rgba(225,82,82,0.12)", color: "#C13E3E", label: "Cancelled" },
};

function getStatusStyle(status: string) {
  const key = status?.toLowerCase() ?? "";
  return STATUS_STYLES[key] ?? { bg: "rgba(90,106,122,0.1)", color: "#5A6A7A", label: status };
}

function initials(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function to12h(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function AdminRidesPage() {
  const [rides, setRides] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadRides() {
    try {
      const res = await fetch("/api/admin/rides");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load rides");
      setRides(data.rides ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rides");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRide(id: string) {
    const confirmed = window.confirm("Cancel and delete this ride? This will unassign the trips.");
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/rides/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete ride");
      setRides((current) => current.filter((ride) => ride._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete ride");
    }
  }

  useEffect(() => {
    loadRides();
  }, []);

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
      `}</style>

      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, gap: 12, flexWrap: "wrap" }}>
          <div>
            <p className="mono" style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#00877A" }}>
              Admin · Rides Dispatch
            </p>
            <h1 className="display" style={{ margin: "6px 0 0", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, color: "#0B1E3D" }}>
              Rides Board
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#5A6A7A" }}>
              {loading ? "Loading rides board…" : `${rides.length} ride${rides.length === 1 ? "" : "s"} on the board`}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/trips" className="tab-btn inactive">
              Single Trips
            </Link>
            <Link href="/admin/rides" className="tab-btn active">
              Matched Rides
            </Link>
            <a
              href="/admin/dashboard"
              style={{ textDecoration: "none", padding: "11px 18px", borderRadius: 10, color: "#0B1E3D", fontWeight: 600, fontSize: 14, background: "#ffffff", border: "1px solid #E6EAEC" }}
            >
              Dashboard
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
              <h2 className="display" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0B1E3D" }}>All Matched Rides</h2>
              <p style={{ margin: "3px 0 0", color: "#5A6A7A", fontSize: 13 }}>View and manage multi-passenger matched rides across drivers.</p>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
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
                    <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#5A6A7A" }}>
                      Loading rides...
                    </td>
                  </tr>
                ) : rides.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#5A6A7A" }}>
                      No rides matched yet. Go to Admin Dashboard to match trips into a ride.
                    </td>
                  </tr>
                ) : (
                  rides.map((ride) => {
                    const st = getStatusStyle(ride.status);
                    const driverName = ride.driverId?.name ?? "Unassigned";
                    const routeStops = ride.route ?? [];
                    const firstStop = routeStops[0]?.point?.address ?? ride.pickupStation?.name ?? "First station";
                    const lastStop = routeStops[routeStops.length - 1]?.point?.address ?? ride.dropoffStation?.name ?? "Final station";
                    const vLabel = VEHICLES[ride.vehicleType as VehicleKey]?.label ?? ride.vehicleType;

                    return (
                      <tr key={ride._id}>
                        <td>
                          <div>
                            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "#0B1E3D" }}>
                              Ride #{ride.rideNumber ?? ride._id.slice(-6)}
                            </span>
                            <span style={{ display: "block", fontSize: 11, color: "#5A6A7A", marginTop: 2 }}>
                              {ride.passengers?.length ?? 0} passenger{(ride.passengers?.length ?? 0) === 1 ? "" : "s"} · {ride.totalCost} EGP
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="driver-chip">
                            <div className="avatar">{initials(driverName)}</div>
                            <div>
                              <span className="name">{driverName}</span>
                              {ride.driverId?.phone && (
                                <span style={{ display: "block", fontSize: 11, color: "#5A6A7A" }}>{ride.driverId.phone}</span>
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
                                <span style={{ fontSize: 11, color: "#00877A", fontWeight: 600, paddingLeft: 12 }}>
                                  + {routeStops.length - 2} intermediate station(s)
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
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D", display: "block" }}>{ride.date}</span>
                            <span className="mono" style={{ fontSize: 12, color: "#5A6A7A" }}>
                              {to12h(ride.startTime)} – {to12h(ride.endTime)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D" }}>{vLabel}</span>
                            <span style={{ display: "block", fontSize: 11, color: "#5A6A7A", textTransform: "capitalize" }}>
                              {ride.rideType} ride
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="status-pill" style={{ background: st.bg, color: st.color }}>
                            {st.label ?? ride.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              className="action-btn delete"
                              onClick={() => deleteRide(ride._id)}
                              title={ride.status === "completed" ? "Cannot delete a completed ride" : "Delete / cancel ride"}
                              disabled={ride.status === "completed"}
                              style={ride.status === "completed" ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
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
        </section>
      </div>
    </main>
  );
}
