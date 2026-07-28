import { redirect, notFound } from "next/navigation";
import {
  Car,
  MapPin,
  Clock,
  Route,
  Users,
  CalendarDays,
  Notebook,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { expireStaleRequest, getUserRequest } from "@/lib/services/requests";
import { VEHICLES } from "@/lib/config/vehicles";
import type { VehicleKey } from "@/lib/config/vehicles";
import AppHeader from "@/components/layout/AppHeader";
import RouteMap from "@/components/shared/RouteMap";
import ContinueCheckoutButton from "@/components/shared/ContinueCheckoutButton";
import type { GeoPoint as Pt, StationSelection } from "@/types/geo";
import type { PaymentStatus, BookingStatus } from "@/types/booking";

export const metadata = { title: "Request details — Commuter" };
export const dynamic = "force-dynamic";

// ── helpers ──────────────────────────────────────────────────────────────────

function to12h(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function prettyDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const PAY_PILL: Record<
  PaymentStatus,
  { label: string; bg: string; color: string }
> = {
  pending: { label: "Awaiting payment", bg: "#FFF8E1", color: "#E65100" },
  paid: { label: "Paid", bg: "#E8F5E9", color: "#27AE60" },
  failed: { label: "Payment failed", bg: "#FFEBEE", color: "#E74C3C" },
  refunded: { label: "Refunded", bg: "#EDE7F6", color: "#6A1B9A" },
  expired: { label: "Expired", bg: "#F5F5F5", color: "#9aa7b4" },
};

const STATUS_PILL: Record<
  BookingStatus,
  { label: string; bg: string; color: string }
> = {
  pending_payment: {
    label: "Pending payment",
    bg: "#FFF3E0",
    color: "#E65100",
  },
  submitted: { label: "Submitted", bg: "#E2E8F0", color: "#5A6A7A" },
  matched: { label: "Matched", bg: "#00C2A8", color: "#fff" },
  confirmed: { label: "Confirmed", bg: "#E8F5E9", color: "#27AE60" },
  active: { label: "Active", bg: "#00C2A8", color: "#fff" },
  completed: { label: "Completed", bg: "#0B1E3D", color: "#fff" },
  cancelled: { label: "Cancelled", bg: "#FFEBEE", color: "#E74C3C" },
  time_out: { label: "Timed out", bg: "#F5F5F5", color: "#9aa7b4" },
};

function Pill({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 12px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  if (!session) redirect(`/login?redirect=/my-requests/${id}`);
  await expireStaleRequest(id, session.userId);
  const detail = await getUserRequest(session.userId, id);
  if (!detail) notFound();

  const { request, trips: rawTrips, walletBalance } = detail;
  const { dates, amountEgp, paymentStatus, status, createdAt } = request;
  // Group materialized trips by date for detail display
  const tripsByDate = new Map<
    string,
    {
      date: string;
      cycleIndex: number;
      pickup: Pt;
      dropoff: Pt;
      vehicleType: string;
      rideType: string;
      arrivalTime: string;
      pickupTime: string;
      distanceKm: number;
      durationMinutes: number;
      priceEgp: number;
      extraPassengers: number;
      pickupStation?: StationSelection;
      dropoffStation?: StationSelection;
      walkingMinToStation?: number;
      walkingMinFromStation?: number;
    }[]
  >();
  for (const t of rawTrips) {
    if (!tripsByDate.has(t.date)) tripsByDate.set(t.date, []);
    tripsByDate.get(t.date)!.push(t);
  }
  const sortedDates = Array.from(tripsByDate.keys()).sort();

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader authed email={session.email} variant="app" backHref="/" />

      <main
        style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px 56px" }}
      >
        {/* Summary header */}
        <div style={{ marginBottom: 18 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              color: "#5A6A7A",
              marginBottom: 8,
            }}
          >
            <CalendarDays size={14} aria-hidden="true" />
            {dates.map((d) => prettyDate(d)).join(" · ")}
            {dates.length > 1 && ` (× ${dates.length} days)`}
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill {...(PAY_PILL[paymentStatus] ?? PAY_PILL.pending)} />
              <Pill {...(STATUS_PILL[status] ?? STATUS_PILL.pending_payment)} />
            </div>
            <span
              style={{
                fontWeight: 900,
                fontSize: 22,
                color: "#0B1E3D",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {amountEgp} EGP
            </span>
          </div>
        </div>

        {/* Trips — grouped by date */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {sortedDates.flatMap((date) => {
            const dateCycles = tripsByDate.get(date) ?? [];
            return [
              <p
                key={`date-${date}`}
                style={{
                  margin: "8px 0 4px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#5A6A7A",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <CalendarDays size={13} aria-hidden="true" />
                {prettyDate(date)}
              </p>,
              ...dateCycles.map((t) => {
                const vLabel =
                  VEHICLES[t.vehicleType as VehicleKey]?.label ?? t.vehicleType;
                return (
                  <div
                    key={`${date}-${t.cycleIndex}`}
                    style={{
                      background: "#fff",
                      borderRadius: 16,
                      border: "1px solid #eef0f3",
                      overflow: "hidden",
                    }}
                  >
                    <RouteMap
                      pickup={t.pickup}
                      dropoff={t.dropoff}
                      height={180}
                    />

                    <div style={{ padding: "16px 18px" }}>
                      {/* Trip header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 14,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#5A6A7A",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Trip {t.cycleIndex + 1}
                        </span>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: 16,
                            color: "#00C2A8",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {t.priceEgp} EGP
                        </span>
                      </div>

                      {/* Route */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          marginBottom: 16,
                        }}
                      >
                        <div style={{ display: "flex", gap: 10 }}>
                          <MapPin
                            size={16}
                            color="#00C2A8"
                            style={{ marginTop: 2, flexShrink: 0 }}
                            aria-hidden="true"
                          />
                          <div>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#9aa7b4",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                            >
                              Pickup
                            </p>
                            <p
                              style={{
                                margin: "2px 0 0",
                                fontSize: 14,
                                color: "#0B1E3D",
                              }}
                            >
                              {t.pickup?.address ?? "—"}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <MapPin
                            size={16}
                            color="#E74C3C"
                            style={{ marginTop: 2, flexShrink: 0 }}
                            aria-hidden="true"
                          />
                          <div>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#9aa7b4",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                            >
                              Dropoff
                            </p>
                            <p
                              style={{
                                margin: "2px 0 0",
                                fontSize: 14,
                                color: "#0B1E3D",
                              }}
                            >
                              {t.dropoff?.address ?? "—"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Detail grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 12,
                          borderTop: "1px solid #f4f6f8",
                          paddingTop: 14,
                        }}
                      >
                        <Detail
                          icon={<Car size={15} color="#0B1E3D" />}
                          label="Vehicle"
                          value={`${vLabel}  (${t.rideType})`}
                        />
                        <Detail
                          icon={<Users size={15} color="#0B1E3D" />}
                          label="Extra passengers"
                          value={String(t.extraPassengers)}
                        />
                        <Detail
                          icon={<Clock size={15} color="#0B1E3D" />}
                          label="Pickup time"
                          value={to12h(t.pickupTime)}
                        />
                        <Detail
                          icon={<Clock size={15} color="#0B1E3D" />}
                          label="Arrival time"
                          value={to12h(t.arrivalTime)}
                        />
                        <Detail
                          icon={<Route size={15} color="#0B1E3D" />}
                          label="Distance"
                          value={`+${t.distanceKm} km`}
                        />
                        <Detail
                          icon={<Clock size={15} color="#0B1E3D" />}
                          label="Drive time"
                          value={`+${t.durationMinutes} min`}
                        />
                        {t.rideType === "shared" && t.pickupStation && (
                          <Detail
                            icon={<MapPin size={15} color="#00C2A8" />}
                            label="Pickup station"
                            value={`${t.pickupStation.name} · ${t.walkingMinToStation ?? 0} min walk`}
                          />
                        )}
                        {t.rideType === "shared" && t.dropoffStation && (
                          <Detail
                            icon={<MapPin size={15} color="#E74C3C" />}
                            label="Dropoff station"
                            value={`${t.dropoffStation.name} · ${t.walkingMinFromStation ?? 0} min walk`}
                          />
                        )}
                      </div>
                      {status === "pending_payment" ||
                      status === "submitted" ||
                      status === "matched" ? (
                        <div className="mt-3">
                          <Detail
                            icon={<Notebook size={15} color="#0B1E3D" />}
                            label="Note"
                            value={
                              "The exact Arrival time, Distance and Drive time will be calculated after a driver is assigned."
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              }),
            ];
          })}
        </div>

        {/* Pay CTA for unpaid bookings */}
        {(paymentStatus === "pending" || paymentStatus === "failed") && (
          <div style={{ marginTop: 20, borderRadius: 14, overflow: "hidden" }}>
            <ContinueCheckoutButton
              bookingId={id}
              amountEgp={amountEgp}
              walletBalance={walletBalance}
            />
          </div>
        )}

        <p
          style={{
            fontSize: 12,
            color: "#9aa7b4",
            textAlign: "center",
            marginTop: 20,
          }}
        >
          Requested {new Date(createdAt).toLocaleString("en-EG")}
        </p>
      </main>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            color: "#9aa7b4",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </p>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: 14,
            color: "#0B1E3D",
            fontWeight: 600,
            // textTransform: "capitalize",
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
