/**
 * Shared types — single source of truth for fields used by both user and driver portals.
 * All field names use snake_case to match the Laravel API response format directly.
 */

// ── Saved addresses ──────────────────────────────────────────────────────────

export interface SavedAddress {
  _id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

// ── Primitive unions ─────────────────────────────────────────────────────────

export type RideType = "shared" | "private";
export type GenderPref = "same" | "mixed";
export type WalkMinutes = 0 | 5 | 10;
export type TripType = "one_way" | "round_trip";
export type WeekDay = "Sat" | "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
export type GroupType = "friends" | "open";
export type GroupAction = "create" | "join";

export type RequestStatus =
  | "available" // driver portal: visible to drivers
  | "submitted" // user submitted, awaiting match
  | "matched" // system is finished matching
  | "finding_driver" // matched — now finding/confirming a driver
  | "driver_offered" // a driver was proposed
  | "price_raised" // driver proposed a higher price
  | "confirmed" // passenger accepted the match
  | "active" // cycle is running
  | "completed"
  | "cancelled";

// ── Cycle day record ─────────────────────────────────────────────────────────

export interface CycleDayRecord {
  date: string; // 'YYYY-MM-DD'
  pickup_time?: string; // 'HH:MM' actual pickup time
  dropoff_time?: string; // 'HH:MM' actual drop-off time
  driver_name?: string;
  status: "completed" | "cancelled" | null; // null = passenger no-show
}

// ── Seat types ────────────────────────────────────────────────────────────────

export type SeatId = "front-passenger" | "rear-left" | "rear-right";
export type SeatType = "front" | "rear-window";

export interface SelectedSeat {
  id: SeatId;
  label: string;
  type: SeatType;
  extra_cost_egp: number;
}

export type SeatPreference = "any" | SelectedSeat;

export const SEAT_COSTS: Record<SeatType, number> = {
  front: 10,
  "rear-window": 8,
};

export const SEAT_LABELS: Record<SeatId, string> = {
  "front-passenger": "Front seat (Passenger side)",
  "rear-left": "Rear seat (Left / Window)",
  "rear-right": "Rear seat (Right / Window)",
};

// ── Location / geo ───────────────────────────────────────────────────────────

export interface GeoLocation {
  address: string;
  lat: number;
  lng: number;
}

export interface PickupPoint {
  passenger_id: string;
  passenger_name: string;
  passenger_gender: "male" | "female";
  lat: number;
  lng: number;
  address: string;
  pickup_time_offset: number; // minutes after cycle departure_time
}

// ── Schedule types ────────────────────────────────────────────────────────────

export interface TimeSlot {
  id: string;
  trip_type: TripType;

  // Route for this slot
  origin: GeoLocation | null;
  stops: GeoLocation[]; // shared-ride flow only, max 2
  /** Private ride only — per-day intermediate stops (up to 2 per day). */
  day_stops?: Partial<Record<WeekDay, GeoLocation[]>>;
  destination: GeoLocation | null;
  route: import("@/lib/openrouteservice").ORSRoute | null;
  route_set: boolean; // true once user confirmed the route

  // Return route (round trip only)
  return_origin: GeoLocation | null; // default: destination
  return_destination: GeoLocation | null; // default: origin
  return_route: import("@/lib/openrouteservice").ORSRoute | null;
  return_customized: boolean;

  // Pickup time window
  pickup_from: string; // "HH:MM" snapped to :00 or :30
  pickup_to: string;

  // Arrival window (computed from pickup_to + route duration)
  arrival_from: string; // computed, read-only
  arrival_to: string; // computed, read-only

  // Return pickup (round trip only)
  return_pickup_from?: string;
  return_pickup_to?: string;
  return_arrival_from?: string; // computed
  return_arrival_to?: string; // computed

  // ── Private-ride additions ───────────────────────────────────────────────
  /** Optional meeting point for outbound pickup (private only) */
  pickup_point?: GeoLocation | null;
  /** Optional meeting point for return pickup (private only, round trip) */
  return_pickup_point?: GeoLocation | null;
  /** Per-passenger seat assignment (private only).
   *  Key is "me" for the account holder or stringified passenger id. */
  seat_assignments?: Record<string, PrivateSeatPosition>;
  /** User-picked arrival window (private flow makes these editable). */
  return_stops?: GeoLocation[];

  // Days assigned to this slot
  days: WeekDay[];
}

// ── Private ride seat positions ──────────────────────────────────────────────

export type PrivateSeatPosition =
  | "front"
  | "back_left"
  | "back_center"
  | "back_right";

export const PRIVATE_SEAT_LABELS: Record<PrivateSeatPosition, string> = {
  front: "Front",
  back_left: "Back left",
  back_center: "Back center",
  back_right: "Back right",
};

// ── Group ─────────────────────────────────────────────────────────────────────

export interface RideGroup {
  code: string; // "XK9-4BT"
  creator_id: string;
  member_ids: string[]; // max 3 for shared, max 4 for private
  max_members: number; // 3 for shared, 4 for private
  created_at: string;
  expires_at: string; // group code expires after 48h if no request
}

// ── Core request (shared between user and driver) ─────────────────────────────

export interface CycleRequestCore {
  id: string;
  status: RequestStatus;
  origin: GeoLocation;
  destination: GeoLocation;
  distance_km: number;
  duration_minutes: number;
  route_coordinates?: [number, number][];
  trip_type: TripType;
  days: WeekDay[];
  time_slots?: TimeSlot[];
  // Legacy fallback fields retained for existing mocked data until full migration.
  arrival_from?: string;
  arrival_to?: string;
  return_arrival_from?: string;
  return_arrival_to?: string;
  departure_from: string; // computed: arrival_from - duration_minutes
  departure_to: string; // computed: arrival_to - duration_minutes
  return_departure_from?: string;
  return_departure_to?: string;
  cycle_start_date: string; // ISO date string — auto-computed, never user-set
  cycle_end_date: string; // always cycle_start_date + 6 days
  ride_type: RideType;
  gender_pref: GenderPref;
  seat_preference: SeatPreference;
  walk_minutes: WalkMinutes;
  base_price: number; // EGP / week (driver's price)
  offered_price?: number; // driver counter-offer
  estimated_price_min: number; // EGP / week
  estimated_price_max: number;
  passenger_count: number;
  group_type: GroupType | null;
  group_action: GroupAction | null;
  group_code?: string;
  group_id?: string;
  pickup_points: PickupPoint[];
  created_at: string; // ISO datetime
  cycle_days?: CycleDayRecord[];
  /** Daily live trip for today (when cycle is active). */
  today_trip_id?: string;
  cycle_id?: string;
}
