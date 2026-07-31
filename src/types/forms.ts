import type { StationOption } from "@/lib/geo/stations";
import type { GeoPoint } from "./geo";

// Client-submitted trip form shapes for POST /api/trips.
// Server ALWAYS recomputes pricing/timing from these — never trusts client totals.

export interface PassengerInput {
  sameAsMain: boolean;
  pickup?: GeoPoint | null;
  dropoff?: GeoPoint | null;
}

export interface StopInput {
  point: GeoPoint;
  alighting: number;
  boarding: number;
  waitingMinutes: number;
}

export interface TripInput {
  pickup: GeoPoint;
  dropoff: GeoPoint;
  vehicleType: string;
  arrivalTime?: string;
  pickupTime?: string;
  distanceKm: number;
  durationMinutes: number;
  priceEgp: number;
  extraPassengers?: number;
  passengers?: PassengerInput[];
  numberOfPassengers?: number;
  stops?: StopInput[];
  pickupStation?: { id: number; lat: number; lng: number; name: string };
  dropoffStation?: { id: number; lat: number; lng: number; name: string };
  pickupStationOptions?: StationOption[];
  dropoffStationOptions?: StationOption[];
  walkingMinToStation?: number;
  walkingMinFromStation?: number;
}
