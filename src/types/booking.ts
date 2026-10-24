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
  | "waiting_list"
  | "approved"
  | "rejected"
  | "submitted"
  | "matched"
  | "nomatch"
  | "confirmed"
  | "active"
  | "completed"
  | "cancelled"
  | "time_out";

export type TripStatus =
  | "pending_payment"
  | "waiting_list"
  | "private_ride_offered"
  | "approved"
  | "rejected"
  | "submitted"
  | "matched"
  | "nomatch"
  | "confirmed"
  | "active"
  | "completed"
  | "no_show"
  | "refunded"
  | "cancelled"
  | "time_out";

// ── API / view-model row shapes ───────────────────────────────────────────────

export type RideStatus =
  | "matched"
  | "confirmed"
  | "active"
  | "completed"
  | "cancelled";

export interface RidePassengerRow {
  tripId: string;
  userId?: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupOrder: number;
  dropoffOrder: number;
  numberOfPassengers: number;
  tripCost: number;
  status: string;
  passengerNumber: number;
  pickupStation?: StationSelection | null;
  dropoffStation?: StationSelection | null;
  seatNumbers?: number[];
  arrivedAt?: string | null;
  noShowAt?: string | null;
  passengerName?: string;
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
  routeCoordinates?: LatLng[];
  chatTripId: string | null;
  hasOpenIncident: boolean;
  noShowMinWaitMinutes: number;
  driverOrigin?: GeoPoint | null;
  driverDestination?: GeoPoint | null;
}

/** Flat trip row for the /my-trips history list and GET /api/trips. */
export interface TripListRow {
  id: string;
  tripNumber: number;
  requestId: string;
  isStandalone: boolean;
  date: string;
  paymentStatus: PaymentStatus;
  status: TripStatus;
  privateRideOffer?: {
    vehicleType: "private_car" | "taxi_private";
    priceEgp: number;
  } | null;
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
  note?: string;
  reviewedBy?: string | null;
  kashierSessionId?: string;
  kashierOrderId?: string;
  kashierTransactionIds?: string[];
  paidAt?: string | null;
  parentRequestStatus?: BookingStatus;
  parentPaymentStatus?: PaymentStatus;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  hasPastTrip?: boolean;
  cancelledBy?: string;
  cancelReason?: string;
  cancellation?: {
    refundStatus?: string;
    refundAmount?: number;
    reason?: string;
  } | null;
  createdAt: string;
  assignedDriver?: {
    name?: string;
    phone?: string;
    profilePic?: string;
    profilePicture?: string;
    carBrand?: string;
    carModel?: string;
    carType?: string;
    modelYear?: string;
    vehicleColor?: string;
    carColor?: string;
    carCapacity?: number;
    carImage?: string;
    plate?: string;
    plateChar1?: string;
    plateChar2?: string;
    plateChar3?: string;
    plateDigits?: string;
  } | null;
  rating?: { driverRating: number; carRating: number } | null;
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
  rejectionReason: string | null;
  reviewedAt: string | null;
  hasPastTrip?: boolean;
  createdAt: string;
}
