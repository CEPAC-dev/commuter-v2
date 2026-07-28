// Shared geo primitives. Import these instead of re-declaring per file.

export interface LatLng {
  lat: number;
  lng: number;
}

/** A named/addressed location point. Mirrors TripPoint in lib/store/useTripStore. */
export interface GeoPoint {
  address: string;
  lat: number;
  lng: number;
}

/** A user-selected station (shared/station ride pickup or dropoff). */
export interface StationSelection {
  id: number;
  name: string;
  direction?: string;
  stationType: string;
  lat: number;
  lng: number;
}
