"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type PointLike = {
  address?: string;
  lat?: number;
  lng?: number;
};

type StationLike = {
  id?: number;
  name?: string;
  lat: number;
  lng: number;
};

type TripOption = {
  _id: string;
  tripNumber?: number;
  date: string;
  pickupTime: string;
  arrivalTime: string;
  pickup: PointLike;
  dropoff: PointLike;
  pickupStation?: StationLike;
  dropoffStation?: StationLike;
  vehicleType: string;
  rideType: string;
  priceEgp: number;
  numberOfPassengers?: number;
  userId: string;
};

type AvailabilityOption = {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
};

type DriverOption = {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
};

type MatchRideFormProps = {
  initialDate: string;
  availabilities: AvailabilityOption[];
  drivers: DriverOption[];
  trips: TripOption[];
};

type PassengerInput = {
  pickupOrder: number;
  dropoffOrder: number;
  numberOfPassengers: number;
  priceEgp: number;
  seatNumbers?: number[];
};

const VEHICLE_OPTIONS = [
  { value: "private_car", label: "Private Car" },
  { value: "shared_car", label: "Shared Car" },
  { value: "taxi_private", label: "Private Taxi" },
  { value: "taxi_shared", label: "Shared Taxi" },
  { value: "van_shared", label: "Shared Van" },
  { value: "microbus_shared", label: "Shared Microbus" },
];

export default function MatchRideForm({
  initialDate,
  availabilities,
  drivers,
  trips,
}: MatchRideFormProps) {
  const [tripDateFilter, setTripDateFilter] = useState(initialDate);
  const [availabilityId, setAvailabilityId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [rideType, setRideType] = useState("shared");
  const [vehicleType, setVehicleType] = useState("taxi_shared");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("18:30");
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [passengerInputs, setPassengerInputs] = useState<
    Record<string, PassengerInput>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [orderedPoints, setOrderedPoints] = useState<
    Array<{
      id: string;
      type: "pickup" | "dropoff";
      tripId: string;
      tripNumber?: number;
      address: string;
      point: PointLike;
    }>
  >([]);

  useEffect(() => {
    if (!availabilityId && availabilities[0]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailabilityId(String(availabilities[0]._id));
    }
  }, [availabilityId, availabilities]);

  useEffect(() => {
    if (!driverId && drivers[0]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDriverId(String(drivers[0]._id));
    }
  }, [driverId, drivers]);

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => trip.date === tripDateFilter);
  }, [trips, tripDateFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPassengerInputs((current) => {
      const next: Record<string, PassengerInput> = { ...current };
      selectedTripIds.forEach((tripId, index) => {
        const existing = next[tripId] ?? {};
        const selectedTrip = trips.find((trip) => String(trip._id) === tripId);
        const pickupOrder = rideType === "shared" ? index + 1 : 1;
        const dropoffOrder =
          rideType === "shared" ? selectedTripIds.length - index : 1;
        next[tripId] = {
          pickupOrder: existing.pickupOrder ?? pickupOrder,
          dropoffOrder: existing.dropoffOrder ?? dropoffOrder,
          numberOfPassengers:
            existing.numberOfPassengers ??
            selectedTrip?.numberOfPassengers ??
            1,
          priceEgp: existing.priceEgp ?? selectedTrip?.priceEgp ?? 0,
        };
      });
      return next;
    });
  }, [rideType, selectedTripIds, trips]);

  useEffect(() => {
    const currentIds = new Set(orderedPoints.map((p) => p.id));
    const newPoints: Array<{
      id: string;
      type: "pickup" | "dropoff";
      tripId: string;
      tripNumber?: number;
      address: string;
      point: PointLike;
    }> = [];

    selectedTripIds.forEach((tripId) => {
      const trip = trips.find((t) => String(t._id) === tripId);
      if (!trip) return;

      const pickupId = `pickup-${tripId}`;
      const dropoffId = `dropoff-${tripId}`;

      // Shared rides route via stations, not raw origin/destination
      const pickupPoint = trip.pickupStation
        ? {
            lat: trip.pickupStation.lat,
            lng: trip.pickupStation.lng,
            address: trip.pickupStation.name ?? "Pickup station",
          }
        : trip.pickup;
      const dropoffPoint = trip.dropoffStation
        ? {
            lat: trip.dropoffStation.lat,
            lng: trip.dropoffStation.lng,
            address: trip.dropoffStation.name ?? "Dropoff station",
          }
        : trip.dropoff;

      if (!currentIds.has(pickupId)) {
        newPoints.push({
          id: pickupId,
          type: "pickup",
          tripId,
          tripNumber: trip.tripNumber,
          address:
            trip.pickupStation?.name ??
            trip.pickup?.address ??
            "Pickup location",
          point: pickupPoint,
        });
      }

      if (!currentIds.has(dropoffId)) {
        newPoints.push({
          id: dropoffId,
          type: "dropoff",
          tripId,
          tripNumber: trip.tripNumber,
          address:
            trip.dropoffStation?.name ??
            trip.dropoff?.address ??
            "Dropoff location",
          point: dropoffPoint,
        });
      }
    });

    const validTripIds = new Set(selectedTripIds);
    const updated = orderedPoints
      .filter((p) => validTripIds.has(p.tripId))
      .concat(newPoints);

    // Recompute ordered points from selection
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderedPoints(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTripIds, trips]);

  function movePoint(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedPoints.length) return;
    const next = [...orderedPoints];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setOrderedPoints(next);
  }

  function toggleTrip(tripId: string) {
    setSelectedTripIds((current) => {
      if (current.includes(tripId)) {
        return current.filter((value) => value !== tripId);
      }
      return [...current, tripId];
    });
  }

  function updatePassengerInput(
    tripId: string,
    field: keyof PassengerInput,
    value: string | number | number[],
  ) {
    setPassengerInputs((current) => ({
      ...current,
      [tripId]: {
        ...current[tripId],
        [field]: Array.isArray(value)
          ? value
          : field === "numberOfPassengers" ||
              field === "priceEgp" ||
              field === "pickupOrder" ||
              field === "dropoffOrder"
            ? Number(value)
            : value,
      },
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!availabilityId || !driverId) {
      setFeedback({
        type: "error",
        message: "Select an availability slot and a driver first.",
      });
      return;
    }

    if (selectedTripIds.length === 0) {
      setFeedback({
        type: "error",
        message: "Choose at least one trip to match into a ride.",
      });
      return;
    }

    const route = orderedPoints.map((pt) => {
      const input = passengerInputs[pt.tripId] ?? { numberOfPassengers: 1 };
      const paxCount = input.numberOfPassengers || 1;
      return {
        point: pt.point,
        boarding: pt.type === "pickup" ? paxCount : 0,
        alighting: pt.type === "dropoff" ? paxCount : 0,
        waitingMinutes: 0,
      };
    });

    const passengers = selectedTripIds.map((tripId) => {
      const trip = trips.find((item) => String(item._id) === tripId);
      const input = passengerInputs[tripId] ?? {
        pickupOrder: 1,
        dropoffOrder: 1,
        numberOfPassengers: 1,
        priceEgp: 0,
      };
      const pIdx = orderedPoints.findIndex((p) => p.id === `pickup-${tripId}`);
      const dIdx = orderedPoints.findIndex((p) => p.id === `dropoff-${tripId}`);
      return {
        tripId,
        userId: trip?.userId,
        pickup: trip?.pickup,
        dropoff: trip?.dropoff,
        pickupOrder: pIdx >= 0 ? pIdx + 1 : input.pickupOrder,
        dropoffOrder: dIdx >= 0 ? dIdx + 1 : input.dropoffOrder,
        numberOfPassengers: input.numberOfPassengers,
        priceEgp: input.priceEgp,
        seatNumbers: input.seatNumbers ?? [],
      };
    });

    setSubmitting(true);

    try {
      const response = await fetch("/api/ride", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availabilityId,
          driverId,
          date,
          vehicleType,
          rideType,
          startTime,
          endTime,
          passengers,
          route,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "The ride could not be created.");
      }

      setFeedback({
        type: "success",
        message: `Ride created successfully with ${passengers.length} trip${passengers.length > 1 ? "s" : ""}.`,
      });
      setSelectedTripIds([]);
      setPassengerInputs({});
      setOrderedPoints([]);
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Unexpected error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const totalSelectedPassengers = selectedTripIds.reduce((sum, tripId) => {
    return sum + (passengerInputs[tripId]?.numberOfPassengers ?? 0);
  }, 0);

  return (
    <section className="match-form">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');

        .match-form {
          --ink: var(--color-primary);
          --teal: var(--color-secondary);
          --teal-deep: var(--color-secondary-deep);
          --amber: var(--color-accent);
          --amber-deep: var(--color-accent-deep);
          --slate: var(--color-muted);
          --line: var(--color-border);
          --canvas: var(--color-surface);
          font-family: 'Inter', system-ui, sans-serif;
          background: var(--color-panel);
          border: 1px solid var(--line);
          border-radius: 18px;
          box-shadow: 0 10px 35px var(--color-shadow);
          padding: 24px;
          margin-top: 20px;
          border-top: 3px solid var(--teal);
        }
        .match-form * { box-sizing: border-box; }
        .match-form .display { font-family: 'Space Grotesk', system-ui, sans-serif; }
        .match-form .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

        .match-form .field-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--slate);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .match-form .field {
          border: 1px solid var(--color-border);
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 14px;
          color: var(--ink);
          background: var(--color-panel);
          width: 100%;
          font-family: 'Inter', system-ui, sans-serif;
          transition: border-color 0.12s ease, box-shadow 0.12s ease;
        }
        .match-form .field:hover { border-color: var(--color-muted); }
        .match-form .field:focus-visible {
          outline: none;
          border-color: var(--teal);
          box-shadow: 0 0 0 3px var(--color-secondary-tint);
        }

        .match-form .trip-card {
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 12px;
          background: var(--color-background);
          transition: border-color 0.12s ease, background 0.12s ease;
        }
        .match-form .trip-card.selected {
          border-color: var(--teal);
          background: var(--color-secondary-tint);
        }
        .match-form .trip-check {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          color: var(--ink);
          cursor: pointer;
        }
        .match-form .trip-check input[type="checkbox"] {
          width: 17px;
          height: 17px;
          accent-color: var(--teal-deep);
          cursor: pointer;
        }

        /* Route order strip: pickup -> dropoff is genuine sequence data for a
           shared ride, so a connected order badge pair earns its place here. */
        .order-strip {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px dashed var(--line);
        }
        .order-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 26px;
          height: 26px;
          padding: 0 6px;
          border-radius: 999px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 12px;
          font-weight: 600;
          background: var(--ink);
          color: var(--color-on-primary);
        }
        .order-track {
          flex: 1;
          height: 1px;
          background-image: repeating-linear-gradient(to right, var(--teal) 0 6px, var(--color-transparent) 6px 11px);
          opacity: 0.6;
        }
        .order-badge.drop { background: var(--amber-deep); }

        .match-form .submit-btn {
          border: 0;
          border-radius: 999px;
          padding: 12px 20px;
          background: var(--ink);
          color: var(--color-on-primary);
          font-weight: 700;
          font-size: 14px;
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: opacity 0.12s ease, transform 0.12s ease;
        }
        .match-form .submit-btn:hover:not(:disabled) { opacity: 0.88; }
        .match-form .submit-btn:active:not(:disabled) { transform: translateY(1px); }
        .match-form .submit-btn:disabled { cursor: wait; opacity: 0.7; }
        .match-form .submit-btn:focus-visible {
          outline: 2px solid var(--teal-deep);
          outline-offset: 2px;
        }

        .match-form select.field {
          appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6'><path d='M0 0l5 6 5-6z' fill='%235A6A7A'/></svg>");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 30px;
        }

        @media (prefers-reduced-motion: reduce) {
          .match-form .field, .match-form .trip-card, .match-form .submit-btn { transition: none; }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <h2
            className="display"
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: "var(--ink)",
            }}
          >
            Create ride from matched trips
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--slate)", fontSize: 14 }}>
            Pick a driver, availability slot, and one or more trips to turn into
            a shared or private ride.
          </p>
        </div>
        {selectedTripIds.length > 0 && (
          <span
            className="mono"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--teal-deep)",
              background: "var(--color-secondary-tint)",
              border: "1px solid var(--color-secondary)",
              borderRadius: 999,
              padding: "6px 12px",
            }}
          >
            {selectedTripIds.length} trip{selectedTripIds.length > 1 ? "s" : ""}{" "}
            · {totalSelectedPassengers} passenger
            {totalSelectedPassengers !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Availability</span>
            <select
              value={availabilityId}
              onChange={(e) => setAvailabilityId(e.target.value)}
              className="field"
            >
              <option value="">Select availability</option>
              {availabilities.map((item) => (
                <option key={String(item._id)} value={String(item._id)}>
                  {item.date} · {item.startTime}–{item.endTime}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Driver</span>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="field"
            >
              <option value="">Select driver</option>
              {drivers.map((driver) => (
                <option key={String(driver._id)} value={String(driver._id)}>
                  {driver.name} {driver.phone ? `· ${driver.phone}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Ride date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Ride type</span>
            <select
              value={rideType}
              onChange={(e) => setRideType(e.target.value)}
              className="field"
            >
              <option value="shared">Shared</option>
              <option value="private">Private</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Vehicle type</span>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="field"
            >
              {VEHICLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Start time</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="field"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="field-label">End time</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="field"
            />
          </label>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <label style={{ display: "grid", gap: 6, minWidth: 220 }}>
              <span className="field-label">Trip date filter</span>
              <input
                type="date"
                value={tripDateFilter}
                onChange={(e) => setTripDateFilter(e.target.value)}
                className="field"
              />
            </label>
            <span style={{ color: "var(--slate)", fontSize: 13 }}>
              {filteredTrips.length} trips available
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
              maxHeight: 320,
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {filteredTrips.length === 0 ? (
              <div
                style={{
                  border: "1px dashed var(--color-border)",
                  borderRadius: 12,
                  padding: 16,
                  color: "var(--slate)",
                }}
              >
                No trips are available for this date yet.
              </div>
            ) : (
              filteredTrips.map((trip) => {
                const tripId = String(trip._id);
                const isSelected = selectedTripIds.includes(tripId);
                const input = passengerInputs[tripId] ?? {
                  pickupOrder: 1,
                  dropoffOrder: 1,
                  numberOfPassengers: trip.numberOfPassengers ?? 1,
                  priceEgp: trip.priceEgp ?? 0,
                };
                return (
                  <div
                    key={tripId}
                    className={`trip-card${isSelected ? " selected" : ""}`}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                    >
                      <label className="trip-check">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTrip(tripId)}
                        />
                        <span>
                          Trip #{trip.tripNumber ?? "—"} · {trip.pickupTime} →{" "}
                          {trip.arrivalTime}
                        </span>
                      </label>
                      <span
                        className="mono"
                        style={{
                          color: "var(--teal-deep)",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        EGP {trip.priceEgp}
                      </span>
                    </div>

                    {isSelected && (
                      <>
                        <div className="order-strip">
                          <span className="order-badge" title="Pickup order">
                            {input.pickupOrder}
                          </span>
                          <span className="order-track" aria-hidden="true" />
                          <span
                            className="order-badge drop"
                            title="Dropoff order"
                          >
                            {input.dropoffOrder}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(110px, 1fr))",
                            gap: 10,
                            marginTop: 10,
                          }}
                        >
                          <label style={{ display: "grid", gap: 5 }}>
                            <span
                              className="field-label"
                              style={{ fontSize: 11 }}
                            >
                              Assign Chair
                            </span>
                            <select
                              value={input.seatNumbers?.[0] ?? ""}
                              onChange={(e) => {
                                const startSeat = Number(e.target.value);
                                const count = input.numberOfPassengers || 1;
                                const seats = startSeat
                                  ? Array.from(
                                      { length: count },
                                      (_, i) => startSeat + i,
                                    )
                                  : [];
                                updatePassengerInput(
                                  tripId,
                                  "seatNumbers",
                                  seats,
                                );
                              }}
                              className="field"
                            >
                              <option value="">Auto Seat</option>
                              {Array.from(
                                {
                                  length: vehicleType.includes("microbus")
                                    ? 9
                                    : vehicleType.includes("van")
                                      ? 5
                                      : 3,
                                },
                                (_, i) => i + 1,
                              ).map((sNo) => (
                                <option key={sNo} value={sNo}>
                                  Chair #{sNo}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label style={{ display: "grid", gap: 5 }}>
                            <span
                              className="field-label"
                              style={{ fontSize: 11 }}
                            >
                              Pickup order
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={input.pickupOrder}
                              onChange={(e) =>
                                updatePassengerInput(
                                  tripId,
                                  "pickupOrder",
                                  e.target.value,
                                )
                              }
                              className="field"
                            />
                          </label>
                          <label style={{ display: "grid", gap: 5 }}>
                            <span
                              className="field-label"
                              style={{ fontSize: 11 }}
                            >
                              Dropoff order
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={input.dropoffOrder}
                              onChange={(e) =>
                                updatePassengerInput(
                                  tripId,
                                  "dropoffOrder",
                                  e.target.value,
                                )
                              }
                              className="field"
                            />
                          </label>
                          <label style={{ display: "grid", gap: 5 }}>
                            <span
                              className="field-label"
                              style={{ fontSize: 11 }}
                            >
                              Passengers
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={input.numberOfPassengers}
                              onChange={(e) =>
                                updatePassengerInput(
                                  tripId,
                                  "numberOfPassengers",
                                  e.target.value,
                                )
                              }
                              className="field"
                            />
                          </label>
                          <label style={{ display: "grid", gap: 5 }}>
                            <span
                              className="field-label"
                              style={{ fontSize: 11 }}
                            >
                              Price
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={input.priceEgp}
                              onChange={(e) =>
                                updatePassengerInput(
                                  tripId,
                                  "priceEgp",
                                  e.target.value,
                                )
                              }
                              className="field"
                            />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {orderedPoints.length > 0 && (
          <div
            style={{
              marginTop: 14,
              padding: 16,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 14,
            }}
          >
            <h3
              className="display"
              style={{
                margin: "0 0 4px",
                fontSize: 15,
                fontWeight: 700,
                color: "var(--color-primary)",
              }}
            >
              Route Points Sequence (First Station → Final Destination)
            </h3>
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 13,
                color: "var(--color-muted)",
              }}
            >
              Reorder the sequence of pickup and dropoff points from 1st (Start
              Station) to Nth (Final Destination).
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {orderedPoints.map((pt, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === orderedPoints.length - 1;
                return (
                  <div
                    key={pt.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: "var(--color-panel)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 10,
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        minWidth: 0,
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          minWidth: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: isFirst
                            ? "var(--color-secondary)"
                            : isLast
                              ? "var(--color-primary)"
                              : "var(--color-muted)",
                          color: "var(--color-on-primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "var(--color-primary)",
                            display: "block",
                          }}
                        >
                          {isFirst
                            ? "1st (Start Station): "
                            : isLast
                              ? `${idx + 1}th (Final Station): `
                              : `${idx + 1}th Station: `}
                          {pt.type === "pickup" ? "Pickup" : "Dropoff"} · Trip #
                          {pt.tripNumber ?? "—"}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--color-muted)",
                            display: "block",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {pt.address}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => movePoint(idx, "up")}
                        disabled={isFirst}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          border: "1px solid var(--color-border)",
                          background: "var(--color-panel)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: isFirst ? "default" : "pointer",
                          opacity: isFirst ? 0.4 : 1,
                        }}
                      >
                        ↑ Up
                      </button>
                      <button
                        type="button"
                        onClick={() => movePoint(idx, "down")}
                        disabled={isLast}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          border: "1px solid var(--color-border)",
                          background: "var(--color-panel)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: isLast ? "default" : "pointer",
                          opacity: isLast ? 0.4 : 1,
                        }}
                      >
                        ↓ Down
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {feedback && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              background:
                feedback.type === "success"
                  ? "var(--color-success-tint)"
                  : "var(--color-warning-tint)",
              color:
                feedback.type === "success"
                  ? "var(--color-success)"
                  : "var(--color-warning)",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {feedback.message}
          </div>
        )}

        <button type="submit" disabled={submitting} className="submit-btn">
          {submitting ? "Creating ride…" : "Create ride"}
        </button>
      </form>
    </section>
  );
}
