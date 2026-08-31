"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Trash2, X } from "lucide-react";
import AddressInput from "@/components/landing/AddressInput";
import AdminTripMap, {
  type TripMapPoint,
} from "@/components/admin/AdminTripMap";
import {
  AdminCard,
  AdminEmptyState,
  AdminErrorState,
  AdminFormLayout,
  AdminLoadingState,
  AdminStatusBadge,
  AdminTable,
} from "@/components/admin/layout";
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
  private: "Private Car",
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
    {
      point: detail.startNearestStation,
      label: "Nearest station to start",
      kind: "station",
    },
    {
      point: detail.endNearestStation,
      label: "Nearest station to end",
      kind: "station",
    },
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

export default function AdminAvailabilityTable({
  initialRecords,
}: {
  initialRecords: AvailabilityRecord[];
}) {
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

  const mapPoints = useMemo(
    () => (detail ? detailPoints(detail) : []),
    [detail],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          throw new Error(
            data?.error ?? `Failed to load availability (HTTP ${res.status})`,
          );
        }
        if (!active) return;
        setDetail(data?.data ?? null);
        setDetailError(null);
      } catch (err) {
        if (!active) return;
        setDetailError(
          err instanceof Error ? err.message : "Failed to load availability",
        );
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
        setCreateError(
          err instanceof Error ? err.message : "Failed to load drivers",
        );
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
    if (
      !driverId ||
      !date ||
      !startTime ||
      !endTime ||
      !startLocation ||
      !endLocation
    ) {
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
        body: JSON.stringify({
          driverId,
          date,
          startTime,
          endTime,
          startLocation,
          endLocation,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(data?.error ?? "Could not create availability.");
      setDriverId("");
      setDate("");
      setStartTime("");
      setEndTime("");
      setStartLocation(null);
      setEndLocation(null);
      closeCreate();
      router.refresh();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not create availability.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/availability/${id}`, {
        method: "DELETE",
      });
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
    <AdminCard
      padding={0}
      title="Driver availability records"
      description="Click a record to view its details, or delete it directly."
      actions={
        <button
          type="button"
          className="avail-btn primary"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={15} /> Add new availability
        </button>
      }
    >
      <style>{`
        .avail-row { cursor: pointer; }
        .avail-row:hover { background: var(--color-secondary-tint); }
        .avail-overlay { position: fixed; inset: 0; z-index: 1200; background: var(--color-overlay); display: flex; }
        .avail-field { display: flex; flex-direction: column; gap: 6px; }
        .avail-field > span { color: var(--color-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
        .avail-field input, .avail-field select { min-height: 40px; border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 10px; color: var(--color-primary); background: var(--color-panel); font: 600 14px inherit; }
        .avail-field input:focus, .avail-field select:focus { outline: 2px solid var(--color-secondary-tint); border-color: var(--color-secondary); }
        .avail-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 8px; border: 1px solid var(--color-transparent); font-size: 13px; font-weight: 600; cursor: pointer; }
        .avail-btn.primary { background: var(--color-secondary); color: var(--color-on-primary); }
        .avail-btn.ghost { background: var(--color-panel); color: var(--color-muted); border-color: var(--color-border); }
        .avail-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .avail-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .avail-detail-label { display: block; margin-bottom: 3px; color: var(--color-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
        @media (max-width: 560px) { .avail-detail-grid { grid-template-columns: 1fr; } }
      `}</style>

      {error ? (
        <AdminErrorState
          title="Unable to update availability"
          description={error}
        />
      ) : null}
      {records.length === 0 ? (
        <AdminEmptyState
          title="No availability records"
          description="Driver availability submissions will appear here."
        />
      ) : (
        <AdminTable ariaLabel="Driver availability records">
          <thead style={{ background: "var(--color-surface)" }}>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  padding: "14px 16px",
                  color: "var(--color-primary)",
                  fontSize: 13,
                }}
              >
                Driver ID
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "14px 16px",
                  color: "var(--color-primary)",
                  fontSize: 13,
                }}
              >
                Driver Name
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "14px 16px",
                  color: "var(--color-primary)",
                  fontSize: 13,
                }}
              >
                Date
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "14px 16px",
                  color: "var(--color-primary)",
                  fontSize: 13,
                }}
              >
                Car type
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "14px 16px",
                  color: "var(--color-primary)",
                  fontSize: 13,
                }}
              >
                Window
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "14px 16px",
                  color: "var(--color-primary)",
                  fontSize: 13,
                }}
              >
                Action
              </th>
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
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                <td
                  style={{
                    padding: "14px 16px",
                    color: "var(--color-primary)",
                    fontWeight: 600,
                  }}
                >
                  {record.driver?.userNumber
                    ? `#${record.driver.userNumber}`
                    : "—"}
                </td>
                <td
                  style={{ padding: "14px 16px", color: "var(--color-muted)" }}
                >
                  {record.driver?.name ?? "—"}
                </td>
                <td
                  style={{ padding: "14px 16px", color: "var(--color-muted)" }}
                >
                  {record.date ?? "—"}
                </td>
                <td
                  style={{ padding: "14px 16px", color: "var(--color-muted)" }}
                >
                  {CAR_TYPE_LABELS[record.driver?.carType ?? ""] ?? "—"}
                </td>
                <td
                  style={{ padding: "14px 16px", color: "var(--color-muted)" }}
                >
                  {record.startTime ?? "—"} → {record.endTime ?? "—"}
                </td>
                <td
                  style={{ padding: "14px 16px" }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => handleDelete(record._id)}
                    disabled={deletingId === record._id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: "1px solid var(--color-danger)",
                      background: "var(--color-transparent)",
                      color: "var(--color-danger)",
                      cursor:
                        deletingId === record._id ? "not-allowed" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    <Trash2 size={14} />{" "}
                    {deletingId === record._id ? "Deleting..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}

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
            style={{
              width: "min(560px, 100%)",
              height: "100dvh",
              overflowY: "auto",
              background: "var(--color-panel)",
              borderTop: "3px solid var(--color-secondary)",
              boxShadow: "-12px 0 40px var(--color-shadow-strong)",
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                padding: "20px 24px",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--color-secondary-deep)",
                  }}
                >
                  Availability details
                </p>
                <h3
                  style={{
                    margin: "5px 0 0",
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--color-primary)",
                  }}
                >
                  {detail
                    ? `Availability #${detail.availabilityNumber ?? detail._id.slice(-6)}`
                    : "Loading..."}
                </h3>
                {detail ? (
                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "var(--color-muted)",
                      fontSize: 13,
                    }}
                  >
                    {detail.date} · {detail.startTime} → {detail.endTime}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeDetail}
                aria-label="Close details"
                style={{
                  padding: 4,
                  color: "var(--color-muted)",
                  background: "var(--color-transparent)",
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
                <AdminLoadingState title="Loading availability details..." />
              ) : detailError ? (
                <AdminErrorState
                  title="Unable to load availability"
                  description={detailError}
                />
              ) : detail ? (
                <>
                  {mapPoints.length ? (
                    <div
                      style={{
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <AdminTripMap key={detail._id} points={mapPoints} />
                    </div>
                  ) : (
                    <p
                      style={{
                        margin: 0,
                        color: "var(--color-muted)",
                        fontSize: 13,
                      }}
                    >
                      No coordinates recorded for this availability.
                    </p>
                  )}

                  <section
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      padding: 14,
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 12px",
                        color: "var(--color-primary)",
                        fontSize: 15,
                      }}
                    >
                      Driver
                    </h4>
                    <div className="avail-detail-grid">
                      <div>
                        <span className="avail-detail-label">Name</span>
                        <span
                          style={{
                            color: "var(--color-primary)",
                            fontSize: 14,
                          }}
                        >
                          {detail.driverId?.name ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span className="avail-detail-label">Phone</span>
                        <span
                          style={{
                            color: "var(--color-primary)",
                            fontSize: 14,
                          }}
                        >
                          {detail.driverId?.phone ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span className="avail-detail-label">Status</span>
                        <AdminStatusBadge status={detail.status ?? "unknown"} />
                      </div>
                      <div>
                        <span className="avail-detail-label">Matched</span>
                        <span
                          style={{
                            color: "var(--color-primary)",
                            fontSize: 14,
                          }}
                        >
                          {detail.matched ? "Yes" : "No"}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      padding: 14,
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 12px",
                        color: "var(--color-primary)",
                        fontSize: 15,
                      }}
                    >
                      Locations
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div>
                        <span className="avail-detail-label">
                          Start location
                        </span>
                        <span
                          style={{
                            color: "var(--color-primary)",
                            fontSize: 13,
                          }}
                        >
                          <MapPin
                            size={12}
                            style={{
                              verticalAlign: "-1px",
                              color: "var(--color-secondary)",
                            }}
                          />{" "}
                          {detail.startLocation?.address ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span className="avail-detail-label">
                          Nearest station to start
                        </span>
                        <span
                          style={{
                            color: "var(--color-primary)",
                            fontSize: 13,
                          }}
                        >
                          {detail.startNearestStation?.name ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span className="avail-detail-label">End location</span>
                        <span
                          style={{
                            color: "var(--color-primary)",
                            fontSize: 13,
                          }}
                        >
                          <MapPin
                            size={12}
                            style={{
                              verticalAlign: "-1px",
                              color: "var(--color-primary)",
                            }}
                          />{" "}
                          {detail.endLocation?.address ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span className="avail-detail-label">
                          Nearest station to end
                        </span>
                        <span
                          style={{
                            color: "var(--color-primary)",
                            fontSize: 13,
                          }}
                        >
                          {detail.endNearestStation?.name ?? "—"}
                        </span>
                      </div>
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
          style={{
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !creating)
              closeCreate();
          }}
        >
          <AdminFormLayout
            onSubmit={handleCreate}
            role="dialog"
            aria-modal="true"
            aria-label="Add new availability"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              width: "min(540px, 100%)",
              maxHeight: "min(88dvh, 760px)",
              overflowY: "auto",
              padding: 20,
              borderRadius: 14,
              borderTop: "3px solid var(--color-accent)",
              background: "var(--color-panel)",
              boxShadow: "0 20px 60px var(--color-shadow-strong)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--color-primary)",
                  }}
                >
                  Add new availability
                </h3>
                <p
                  style={{
                    margin: "4px 0 0",
                    color: "var(--color-muted)",
                    fontSize: 13,
                  }}
                >
                  Assign a driver a new availability window.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreate}
                aria-label="Close"
                disabled={creating}
                style={{
                  padding: 4,
                  color: "var(--color-muted)",
                  background: "var(--color-transparent)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <label className="avail-field">
              <span>Driver</span>
              <select
                value={driverId}
                onChange={(event) => setDriverId(event.target.value)}
                required
              >
                <option value="">Select a driver</option>
                {drivers.map((driver) => (
                  <option key={driver._id} value={driver._id}>
                    {driver.userNumber ? `#${driver.userNumber} · ` : ""}
                    {driver.name || driver.phone}
                    {driver.carType
                      ? ` · ${CAR_TYPE_LABELS[driver.carType] ?? driver.carType}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="avail-field">
              <span>Date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </label>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <label className="avail-field">
                <span>Start time</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  required
                />
              </label>
              <label className="avail-field">
                <span>End time</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  required
                />
              </label>
            </div>

            <div className="avail-field">
              <span>Start location</span>
              <AddressInput
                id="avail-start"
                placeholder="Search start address"
                value={startLocation}
                onChange={setStartLocation}
              />
            </div>

            <div className="avail-field">
              <span>End location</span>
              <AddressInput
                id="avail-end"
                placeholder="Search end address"
                value={endLocation}
                onChange={setEndLocation}
                iconColor="var(--color-primary)"
              />
            </div>

            {createError ? (
              <p
                role="alert"
                style={{
                  margin: 0,
                  color: "var(--color-danger)",
                  fontSize: 13,
                }}
              >
                {createError}
              </p>
            ) : null}

            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <button
                type="button"
                className="avail-btn ghost"
                onClick={closeCreate}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="avail-btn primary"
                disabled={creating}
              >
                {creating ? "Creating..." : "Create availability"}
              </button>
            </div>
          </AdminFormLayout>
        </div>
      ) : null}
    </AdminCard>
  );
}
