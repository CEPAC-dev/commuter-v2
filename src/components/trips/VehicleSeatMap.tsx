"use client";

import { useState } from "react";
import { User, X, MapPin, Car, Bus, Truck, Circle } from "lucide-react";
import type { RideDetailView, RidePassengerDetail } from "@/types/booking";
import { useClientLocale } from "@/lib/i18n/client";
import { formatEgp } from "@/lib/i18n";

interface Props {
  ride?: RideDetailView | null;
  vehicleType?: string;
  isDriver?: boolean;
  assignedSeatNumbers?: number[];
  activeStationIndex?: number | null;
  rideStarted?: boolean;
  confirmedStationIndices?: number[];
  stationSelections?: Record<string, Record<string, "arrived" | "no_show">>;
}

export interface SeatGridCell {
  seatNumber: number | null; // null for driver seat
  isDriverSeat?: boolean;
  row: number;
  col: number;
}

export function getVehicleSeatGrid(vType: string): {
  rows: SeatGridCell[][];
  totalSeats: number;
  label: string;
  labelKey: string;
} {
  const isCarOrTaxi =
    vType === "private_car" ||
    vType === "taxi_private" ||
    vType === "taxi_shared";
  const isVan = vType === "van_shared";

  if (isCarOrTaxi) {
    return {
      label: "Private Car / Taxi",
      labelKey: "vehicle_seating.vehicle_type_private",
      totalSeats: 3,
      rows: [
        [
          { seatNumber: null, isDriverSeat: true, row: 0, col: 0 },
          { seatNumber: 1, row: 0, col: 1 },
        ],
        [
          { seatNumber: 2, row: 1, col: 0 },
          { seatNumber: 3, row: 1, col: 1 },
        ],
      ],
    };
  }

  if (isVan) {
    return {
      label: "Van",
      labelKey: "vehicle_seating.vehicle_type_van",
      totalSeats: 5,
      rows: [
        [
          { seatNumber: null, isDriverSeat: true, row: 0, col: 0 },
          { seatNumber: 1, row: 0, col: 1 },
        ],
        [
          { seatNumber: 2, row: 1, col: 0 },
          { seatNumber: 3, row: 1, col: 1 },
        ],
        [
          { seatNumber: 4, row: 2, col: 0 },
          { seatNumber: 5, row: 2, col: 1 },
        ],
      ],
    };
  }

  return {
    label: "Microbus",
    labelKey: "vehicle_seating.vehicle_type_microbus",
    totalSeats: 10,
    rows: [
      [
        { seatNumber: null, isDriverSeat: true, row: 0, col: 0 },
        { seatNumber: 1, row: 0, col: 1 },
      ],
      [
        { seatNumber: 2, row: 1, col: 0 },
        { seatNumber: 3, row: 1, col: 1 },
      ],
      [
        { seatNumber: 4, row: 2, col: 0 },
        { seatNumber: 5, row: 2, col: 1 },
      ],
      [
        { seatNumber: 6, row: 3, col: 0 },
        { seatNumber: 7, row: 3, col: 1 },
      ],
      [
        { seatNumber: 8, row: 4, col: 0 },
        { seatNumber: 9, row: 4, col: 1 },
        { seatNumber: 10, row: 4, col: 2 },
      ],
    ],
  };
}

export function getVehicleChassisStyle(vType: string): {
  Icon: typeof Car;
  accent: string;
  accentSoft: string;
} {
  const isCarOrTaxi =
    vType === "private_car" ||
    vType === "taxi_private" ||
    vType === "taxi_shared";
  const isVan = vType === "van_shared";

  if (isCarOrTaxi) {
    return { Icon: Car, accent: "#0B1E3D", accentSoft: "#EEF2FF" };
  }

  if (isVan) {
    return { Icon: Truck, accent: "#0B6E5A", accentSoft: "#E8F8F5" };
  }

  // Microbus
  return { Icon: Bus, accent: "#8A4B00", accentSoft: "#FFF3E0" };
}

export default function VehicleSeatMap({
  ride,
  vehicleType = "taxi_shared",
  isDriver = false,
  assignedSeatNumbers = [],
  rideStarted = false,
}: Props) {
  const vType = ride?.vehicleType ?? vehicleType;
  const grid = getVehicleSeatGrid(vType);
  const chassis = getVehicleChassisStyle(vType);
  const { t, dir, locale } = useClientLocale();

  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

  const seatStateBySeat = new Map<
    number,
    {
      passenger?: RidePassengerDetail;
      state: "grey" | "green" | "blue" | "red";
      label: string;
    }
  >();

  if (ride?.passengers) {
    // Server clears seatNumbers once a rider's stop has passed, so a dropped_off
    // rider still holding a seat is one who alighted at the latest stop.
    const seatPassengers = new Map<number, RidePassengerDetail[]>();

    for (const p of ride.passengers) {
      const normalizedStatus = p.status?.toLowerCase?.() ?? "";
      const seats = (Array.isArray(p.seatNumbers) ? p.seatNumbers : []).filter(
        (seat): seat is number => typeof seat === "number" && Number.isFinite(seat),
      );

      const shouldShowPassenger =
        rideStarted &&
        ride.status !== "completed" &&
        seats.length > 0 &&
        ["boarding", "on_board", "picked_up", "dropped_off"].includes(normalizedStatus);

      if (!shouldShowPassenger) continue;

      for (const seat of seats) {
        seatPassengers.set(seat, [...(seatPassengers.get(seat) ?? []), p]);
      }
    }

    // Ordered so a newly boarding rider takes over a seat just vacated by an alighted one.
    const seatRules = [
      { state: "green" as const, label: "boarding", match: (s: string) => s === "boarding" },
      {
        state: "blue" as const,
        label: "on_board",
        match: (s: string) => s === "on_board" || s === "picked_up",
      },
      { state: "red" as const, label: "alighted", match: (s: string) => s === "dropped_off" },
    ];

    for (const [seat, passengers] of seatPassengers.entries()) {
      const hit = seatRules
        .map((rule) => ({
          rule,
          passenger: passengers.find((p) => rule.match(p.status?.toLowerCase?.() ?? "")),
        }))
        .find((entry) => entry.passenger);

      seatStateBySeat.set(
        seat,
        hit?.passenger
          ? { passenger: hit.passenger, state: hit.rule.state, label: hit.rule.label }
          : { passenger: undefined, state: "grey", label: "empty" },
      );
    }
  }

  const selectedPassenger = selectedSeat
    ? seatStateBySeat.get(selectedSeat)?.passenger ?? null
    : null;
  const isShared = ride?.rideType === "shared";

  return (
    <div
      dir={dir}
      style={{
        background: "#ffffff",
        borderRadius: 20,
        border: "1px solid #e9edf2",
        padding: "22px 20px",
        marginBottom: 16,
        boxShadow: "0 1px 2px rgba(11,30,61,0.04)",
        textAlign: "center",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: chassis.accentSoft,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <chassis.Icon size={24} color={chassis.accent} />
        </div>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 800,
            color: "#0B1E3D",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {t("vehicle_seating.title_plain")}
        </h3>
        {!isDriver && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "#5A6A7A",
              fontWeight: 500,
            }}
          >
            {t("vehicle_seating.your_assigned")}
          </p>
        )}
      </div>

      {/* Seat Grid — locked ltr so driver/seat order never flips in Arabic */}
      <div
        dir="ltr"
        style={{
          maxWidth: 320,
          margin: "0 auto",
          background: "#F8FAFC",
          borderRadius: 20,
          border: "1px solid #E9EDF2",
          padding: 18,
          direction: "ltr",
          unicodeBidi: "isolate",
        }}
      >
        {/* Front indicator */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: "#94A3B8",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            marginBottom: 14,
            textAlign: "center",
          }}
        >
          {t("vehicle_seating.front")}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {grid.rows.map((row, rIdx) => (
            <div
              key={`row-${rIdx}`}
              dir="ltr"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${row.length}, 1fr)`,
                gap: 10,
                direction: "ltr",
                unicodeBidi: "isolate",
              }}
            >
              {row.map((cell) => {
                if (cell.isDriverSeat) {
                  return (
                    <div
                      key={`driver-seat`}
                      style={{
                        gridColumn: cell.col + 1,
                        padding: "12px 8px",
                        borderRadius: 14,
                        background: chassis.accent,
                        color: "#fff",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 3,
                      }}
                    >
                      <Circle size={15} strokeWidth={2.5} />
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {t("vehicle_seating.front")}
                      </span>
                    </div>
                  );
                }

                const seatNo = cell.seatNumber!;
                const seatState = seatStateBySeat.get(seatNo) ?? {
                  passenger: undefined,
                  state: "grey" as const,
                  label: "empty",
                };
                const isSelected = selectedSeat === seatNo;
                const isMySeat = !isDriver && assignedSeatNumbers.includes(seatNo);

                let bg = "#ffffff";
                let borderColor = "#CBD5E1";
                let color = "#64748B";
                let labelText = t("vehicle_seating.empty");

                if (isMySeat) {
                  bg = "#E8F8F5";
                  borderColor = "#00C2A8";
                  color = "#00806E";
                  labelText = t("vehicle_seating.your_seat");
                } else if (isDriver) {
                  if (!rideStarted || seatState.state === "grey") {
                    bg = "#ffffff";
                    borderColor = "#CBD5E1";
                    color = "#64748B";
                    labelText = t("vehicle_seating.empty");
                  } else if (seatState.state === "green") {
                    bg = "#E8F8F5";
                    borderColor = "#27AE60";
                    color = "#196F3D";
                    labelText = t("vehicle_seating.boarding");
                  } else if (seatState.state === "blue") {
                    bg = "#EFF6FF";
                    borderColor = "#2F80ED";
                    color = "#1D4ED8";
                    labelText = t("vehicle_seating.on_board");
                  } else if (seatState.state === "red") {
                    bg = "#FFEBEE";
                    borderColor = "#E74C3C";
                    color = "#C0392B";
                    labelText = t("vehicle_seating.alighted");
                  }
                }

                if (isSelected) {
                  borderColor = "#F5A623";
                  bg = "#FFF8E1";
                }

                return (
                  <button
                    key={`seat-${seatNo}`}
                    type="button"
                    onClick={() => {
                      if (isDriver) {
                        setSelectedSeat(seatNo);
                      }
                    }}
                    style={{
                      gridColumn: cell.col + 1,
                      padding: "12px 6px",
                      borderRadius: 14,
                      background: bg,
                      border: `1.5px solid ${borderColor}`,
                      color,
                      textAlign: "center",
                      cursor: isDriver ? "pointer" : "default",
                      transition: "box-shadow 0.12s ease",
                      outline: "none",
                      boxShadow: isSelected
                        ? "0 0 0 3px rgba(245,166,35,0.28)"
                        : "none",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      <User size={15} color={color} />
                      <span>{t("vehicle_seating.seat", { n: seatNo })}</span>
                    </div>
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 700,
                        marginTop: 4,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        textAlign: "center",
                      }}
                    >
                      {isMySeat
                        ? t("vehicle_seating.your_seat")
                        : isDriver
                        ? labelText
                        : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 14,
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        {isDriver ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: "#F8FAFC",
                  border: "1px solid #CBD5E1",
                }}
              />
              <span style={{ fontSize: 11, color: "#5A6A7A", fontWeight: 600 }}>
                {t("vehicle_seating.legend_empty")}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: "#E8F8F5",
                  border: "1px solid #27AE60",
                }}
              />
              <span style={{ fontSize: 11, color: "#196F3D", fontWeight: 700 }}>
                {t("vehicle_seating.legend_arrived")}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: "#EFF6FF",
                  border: "1px solid #2F80ED",
                }}
              />
              <span style={{ fontSize: 11, color: "#1D4ED8", fontWeight: 700 }}>
                {t("vehicle_seating.legend_on_board")}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: "#FFEBEE",
                  border: "1px solid #E74C3C",
                }}
              />
              <span style={{ fontSize: 11, color: "#C0392B", fontWeight: 700 }}>
                {t("vehicle_seating.legend_alighted")}
              </span>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: "#fff",
                  border: "1px solid #CBD5E1",
                }}
              />
              <span style={{ fontSize: 11, color: "#5A6A7A", fontWeight: 600 }}>
                {t("vehicle_seating.legend_other")}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: "#E8F8F5",
                  border: "1px solid #00C2A8",
                }}
              />
              <span style={{ fontSize: 11, color: "#5A6A7A", fontWeight: 600 }}>
                {t("vehicle_seating.legend_your")}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Interactive Modal Popup on Seat Click (Driver View Only) */}
      {isDriver && selectedSeat !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11, 30, 61, 0.55)",
            backdropFilter: "blur(3px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setSelectedSeat(null)}
        >
          <div
            style={{
              maxWidth: 420,
              width: "100%",
              background: "#fff",
              borderRadius: 20,
              padding: "24px 22px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #EEF2F6",
                paddingBottom: 14,
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: selectedPassenger ? "#EEF2FF" : "#F1F5F9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <User size={20} color={selectedPassenger ? "#3B82F6" : "#64748B"} />
                </div>
                <div>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#0B1E3D",
                    }}
                  >
                    {t("vehicle_seating.seat_details", { n: selectedSeat })}
                  </h4>
                  <span style={{ fontSize: 12, color: "#5A6A7A", fontWeight: 500 }}>
                    {selectedPassenger ? t("vehicle_seating.occupied_seat") : t("vehicle_seating.empty_seat", { n: selectedSeat })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSeat(null)}
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#64748B",
                }}
                aria-label={t("doc.view")}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            {selectedPassenger ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Passenger Info */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#F8FAFC",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#64748B",
                        textTransform: "uppercase",
                        display: "block",
                      }}
                    >
                      Passenger Name
                    </span>
                    <strong style={{ fontSize: 15, color: "#0B1E3D" }}>
                      {selectedPassenger.passengerName ??
                        `Passenger #${selectedPassenger.pickupOrder}`}
                    </strong>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 14,
                      background:
                        selectedPassenger.status === "picked_up"
                          ? "#E8F8F5"
                          : "#FFF8E1",
                      color:
                        selectedPassenger.status === "picked_up"
                          ? "#00806E"
                          : "#E65100",
                      textTransform: "capitalize",
                    }}
                  >
                    {selectedPassenger.status.replace("_", " ")}
                  </span>
                </div>

                {/* Route Stations or Origin / Destination */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    background: "#fff",
                    padding: "14px",
                    borderRadius: 12,
                    border: "1px solid #EEF2F6",
                  }}
                >
                  {/* Pickup / Origin */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <MapPin
                      size={16}
                      color="#00C2A8"
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#00806E",
                          textTransform: "uppercase",
                          display: "block",
                        }}
                      >
                        {isShared ? t("ride.pickup_station_label") : t("ride.origin_label")}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#0B1E3D",
                        }}
                      >
                        {isShared
                          ? selectedPassenger.pickupStation?.name ??
                            ride?.pickupStation?.name ??
                            t("ride.pickup_station_fallback")
                          : selectedPassenger.pickupAddress}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      height: 1,
                      background: "#F1F5F9",
                      margin: "2px 0",
                    }}
                  />

                  {/* Dropoff / Destination */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <MapPin
                      size={16}
                      color="#E74C3C"
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#C0392B",
                          textTransform: "uppercase",
                          display: "block",
                        }}
                      >
                        {isShared ? t("ride.dropoff_station_label") : t("ride.destination_label")}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#0B1E3D",
                        }}
                      >
                        {isShared
                          ? selectedPassenger.dropoffStation?.name ??
                            ride?.dropoffStation?.name ??
                            t("ride.dropoff_station_fallback")
                          : selectedPassenger.dropoffAddress}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Additional Trip Info */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      background: "#F8FAFC",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #E2E8F0",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#64748B",
                        textTransform: "uppercase",
                        display: "block",
                      }}
                    >
                      {t("vehicle_seating.passengers")}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0B1E3D" }}>
                      {selectedPassenger.numberOfPassengers} {t("my_trips.passenger_singular_short")}
                    </span>
                  </div>
                  <div
                    style={{
                      background: "#F8FAFC",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #E2E8F0",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#64748B",
                        textTransform: "uppercase",
                        display: "block",
                      }}
                    >
                      {t("vehicle_seating.trip_fare")}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0B1E3D" }}>
                      {formatEgp(locale, selectedPassenger.tripCost)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Empty Seat State */
              <div
                style={{
                  textAlign: "center",
                  padding: "20px 10px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "#F1F5F9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <User size={24} color="#94A3B8" />
                </div>
                <h5 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0B1E3D" }}>
                  {t("vehicle_seating.empty_seat", { n: selectedSeat })}
                </h5>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748B" }}>
                  {t("vehicle_seating.no_passenger_assigned")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
