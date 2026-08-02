"use client";

import { useState } from "react";
import { User, X, MapPin, DollarSign, Calendar, Clock } from "lucide-react";
import type { RideDetailView, RidePassengerDetail } from "@/types/booking";

interface Props {
  ride?: RideDetailView | null;
  vehicleType?: string;
  isDriver?: boolean;
  assignedSeatNumbers?: number[];
  activeStationIndex?: number | null;
  rideStarted?: boolean;
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
} {
  const isCarOrTaxi =
    vType === "private_car" ||
    vType === "taxi_private" ||
    vType === "taxi_shared";
  const isVan = vType === "van_shared";

  if (isCarOrTaxi) {
    return {
      label: "Private Car / Taxi",
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
    totalSeats: 9,
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
      ],
    ],
  };
}

export default function VehicleSeatMap({
  ride,
  vehicleType = "taxi_shared",
  isDriver = false,
  assignedSeatNumbers = [],
  activeStationIndex = null,
  rideStarted = false,
}: Props) {
  const vType = ride?.vehicleType ?? vehicleType;
  const grid = getVehicleSeatGrid(vType);

  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

  const passengerBySeat = new Map<number, RidePassengerDetail>();
  if (ride?.passengers) {
    let currentSeat = 1;
    for (let i = 0; i < ride.passengers.length; i++) {
      const p = ride.passengers[i];
      let seats = p.seatNumbers ?? [];
      if (!seats || seats.length === 0) {
        const count = p.numberOfPassengers || 1;
        seats = Array.from({ length: count }, (_, idx) => currentSeat + idx);
        currentSeat += count;
      } else {
        currentSeat = Math.max(currentSeat, Math.max(...seats) + 1);
      }
      for (const s of seats) {
        passengerBySeat.set(s, p);
      }
    }
  }

  const selectedPassenger = selectedSeat ? passengerBySeat.get(selectedSeat) : null;
  const isShared = ride?.rideType === "shared";

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #eef0f3",
        padding: "20px 18px",
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div>
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
            Vehicle Seating Chart ({grid.label})
          </h3>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 12,
              color: "#5A6A7A",
              fontWeight: 500,
            }}
          >
            {isDriver
              ? rideStarted
                ? "Live chair status: Empty, Boarding, Alighting, Onboard"
                : "All chairs empty until ride starts"
              : "Your assigned seat position on board"}
          </p>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 20,
            background: "#EEF2FF",
            color: "#0B1E3D",
          }}
        >
          {grid.totalSeats} Seats
        </span>
      </div>

      {/* 2D Car Chassis Container */}
      <div
        style={{
          maxWidth: 320,
          margin: "0 auto",
          background: "linear-gradient(180deg, #F8FAFC 0%, #EFF3F8 100%)",
          borderRadius: 28,
          border: "2px solid #CBD5E1",
          padding: "24px 20px 20px",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.03)",
          position: "relative",
        }}
      >
        {/* Windshield graphic */}
        <div
          style={{
            height: 14,
            borderRadius: "12px 12px 4px 4px",
            background: "linear-gradient(180deg, #94A3B8 0%, #CBD5E1 100%)",
            marginBottom: 20,
            opacity: 0.7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: "#fff",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            FRONT
          </span>
        </div>

        {/* Seat Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {grid.rows.map((row, rIdx) => (
            <div
              key={`row-${rIdx}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                alignItems: "center",
              }}
            >
              {row.map((cell) => {
                if (cell.isDriverSeat) {
                  return (
                    <div
                      key={`driver-seat`}
                      style={{
                        padding: "10px 8px",
                        borderRadius: 12,
                        background: "#0B1E3D",
                        color: "#fff",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 4px rgba(11,30,61,0.2)",
                      }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1 }}>☸</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          marginTop: 4,
                          letterSpacing: "0.02em",
                        }}
                      >
                        DRIVER
                      </span>
                    </div>
                  );
                }

                const seatNo = cell.seatNumber!;
                const passenger = passengerBySeat.get(seatNo);
                const isOccupied = Boolean(passenger);
                const isSelected = selectedSeat === seatNo;
                const isMySeat = !isDriver && assignedSeatNumbers.includes(seatNo);

                let bg = "#F8FAFC";
                let borderColor = "#CBD5E1";
                let color = "#64748B";
                let labelText = "Empty";

                if (isMySeat) {
                  bg = "#E8F8F5";
                  borderColor = "#00C2A8";
                  color = "#00806E";
                  labelText = "YOUR SEAT";
                } else if (isDriver) {
                  if (!rideStarted || !isOccupied) {
                    // Before ride start or empty seat: neutral empty state
                    bg = "#F8FAFC";
                    borderColor = "#CBD5E1";
                    color = "#64748B";
                    labelText = "Empty";
                  } else {
                    const stIdx = activeStationIndex ?? 0;
                    const pIdx = passenger?.pickupOrder ?? 1;
                    const dIdx = passenger?.dropoffOrder ?? 99;

                    if (activeStationIndex === null) {
                      bg = "#F8FAFC";
                      borderColor = "#CBD5E1";
                      color = "#64748B";
                      labelText = "Empty";
                    } else if (pIdx === stIdx) {
                      // Green: Boarding at this station
                      bg = "#E8F8F5";
                      borderColor = "#27AE60";
                      color = "#196F3D";
                      labelText = "Boarding";
                    } else if (dIdx === stIdx) {
                      // Red: Alighting at this station
                      bg = "#FFEBEE";
                      borderColor = "#E74C3C";
                      color = "#C0392B";
                      labelText = "Alighting";
                    } else if (pIdx < stIdx && dIdx > stIdx) {
                      // Blue: Onboard (picked up earlier, continuing)
                      bg = "#EFF6FF";
                      borderColor = "#2F80ED";
                      color = "#1D4ED8";
                      labelText = "Onboard";
                    } else if (pIdx > stIdx) {
                      bg = "#F8FAFC";
                      borderColor = "#CBD5E1";
                      color = "#64748B";
                      labelText = "Empty";
                    } else {
                      // Neutral empty state
                      bg = "#F8FAFC";
                      borderColor = "#CBD5E1";
                      color = "#64748B";
                      labelText = "Empty";
                    }
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
                      padding: "12px 8px",
                      borderRadius: 12,
                      background: bg,
                      border: `2px solid ${borderColor}`,
                      color,
                      textAlign: "center",
                      cursor: isDriver ? "pointer" : "default",
                      transition: "all 0.15s ease",
                      position: "relative",
                      outline: "none",
                      boxShadow: isSelected
                        ? "0 0 0 3px rgba(245,166,35,0.3)"
                        : "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    {/* Person Icon for all seats */}
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
                      <span>Seat {seatNo}</span>
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
                      }}
                    >
                      {isMySeat
                        ? "YOUR SEAT"
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

        {/* Rear graphic */}
        <div
          style={{
            height: 8,
            borderRadius: "4px 4px 10px 10px",
            background: "#CBD5E1",
            marginTop: 20,
            opacity: 0.6,
          }}
        />
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
                Empty
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
                Boarding
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
                Alighting
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
                Onboard
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
                Other Seats
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
                Your Seat
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
                    Seat #{selectedSeat} Details
                  </h4>
                  <span style={{ fontSize: 12, color: "#5A6A7A", fontWeight: 500 }}>
                    {selectedPassenger ? "Occupied Seat" : "Empty Seat"}
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
                aria-label="Close modal"
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
                        {isShared ? "Pickup Station" : "Origin (Pickup Address)"}
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
                            "Pickup station"
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
                        {isShared ? "Dropoff Station" : "Destination (Dropoff Address)"}
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
                            "Dropoff station"
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
                      Passengers
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0B1E3D" }}>
                      {selectedPassenger.numberOfPassengers} Pax
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
                      Trip Fare
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0B1E3D" }}>
                      {selectedPassenger.tripCost} EGP
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
                  Seat #{selectedSeat} is Empty
                </h5>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748B" }}>
                  No passenger is currently assigned to this chair position.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
