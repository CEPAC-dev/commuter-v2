import type { GeoPoint, LatLng, StationSelection } from "./geo";

// ── Status enums (single source of truth; were duplicated across pages) ───────

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "expired";

export type BookingStatus =
  | "pending_payment"
  | "submitted"
  | "matched"
  | "confirmed"
  | "active"
  | "completed"
  | "cancelled"
  | "time_out";

/** A Trip's lifecycle status uses the same enum as its parent Booking. */
export type TripStatus = BookingStatus;

// ── API / view-model row shapes ───────────────────────────────────────────────

export type RideStatus =
  | "matched"
  | "confirmed"
  | "active"
  | "completed"
  | "cancelled";

export interface RidePassengerRow {
  tripId: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupOrder: number;
  dropoffOrder: number;
  numberOfPassengers: number;
  tripCost: number;
  status: string;
  pickupStation?: StationSelection | null;
  dropoffStation?: StationSelection | null;
}

export interface RideRouteStopRow {
  address: string;
  boarding: number;
  alighting: number;
  waitingMinutes: number;
}

/** Flat ride row for driver ongoing view on /my-trips and GET /api/ride. */
export interface RideListRow {
  id: string;
  rideNumber: number;
  date: string;
  status: RideStatus;
  vehicleType: string;
  rideType: "private" | "shared";
  startTime: string;
  endTime: string;
  totalCost: number;
  passengerCount: number;
  passengers: RidePassengerRow[];
  route: RideRouteStopRow[];
  pickupStation?: StationSelection | null;
  dropoffStation?: StationSelection | null;
  createdAt: string;
}

export interface RidePassengerDetail extends RidePassengerRow {
  pickup: GeoPoint | null;
  dropoff: GeoPoint | null;
}

export interface RideRouteStopDetail extends RideRouteStopRow {
  point: GeoPoint | null;
}

/** Full ride detail for driver /my-trips/[id] when viewing a matched ride. */
export interface RideDetailView
  extends Omit<RideListRow, "passengers" | "route"> {
  passengers: RidePassengerDetail[];
  route: RideRouteStopDetail[];
  chatTripId: string | null;
}

/** Flat trip row for the /my-trips history list and GET /api/trips. */
export interface TripListRow {
  id: string;
  tripNumber: number;
  requestId: string;
  date: string;
  paymentStatus: PaymentStatus;
  status: BookingStatus;
  vehicleType: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickup: LatLng | null;
  dropoff: LatLng | null;
  pickupTime: string;
  arrivalTime: string;
  priceEgp: number;
  distanceKm: number;
  durationMinutes: number;
  bookingAmountEgp: number;
  createdAt: string;
  assignedDriver?: {
    name?: string;
    phone?: string;
    profilePic?: string;
    carBrand?: string;
    carModel?: string;
    modelYear?: string;
    plate?: string;
  } | null;
}

/** Trip summary nested inside a booking card (/my-requests). */
export interface BookingTripRow {
  vehicleType: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickup: LatLng | null;
  dropoff: LatLng | null;
  pickupTime: string;
  arrivalTime: string;
  priceEgp: number;
}

/** A booking (one date + its trips) for the /my-requests list and GET /api/requests. */
export interface BookingRow {
  id: string;
  dates: string[];
  trips: BookingTripRow[];
  amountEgp: number;
  paymentStatus: PaymentStatus;
  status: BookingStatus;
  createdAt: string;
}
