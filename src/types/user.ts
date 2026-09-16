import type { CycleRequestCore, GenderPref, WalkMinutes } from './shared';

export type {
  WeekDay,
  RequestStatus,
  RideType,
  TripType,
  GenderPref,
  WalkMinutes,
  SeatId,
  SeatType,
  SelectedSeat,
  SeatPreference,
  GeoLocation,
  CycleDayRecord,
} from './shared';

// ── Commute Preferences (GET /preferences · POST /preferences) ────────────────

export type GenderPreference     = 'male' | 'female' | 'any';
export type InteractionLevel     = 'quiet' | 'normal' | 'talkative';
export type MusicPreference      = 'no_music' | 'low' | 'normal';
export type WalkingDistancePref  = 'no_walk' | 'less_than_5_min' | '5_to_10_min' | 'more_than_10_min';
export type AirConditioningPref  = 'not_important' | 'preferred_if_available' | 'mandatory';

export interface CommutePreferences {
  gender_preference:            GenderPreference;
  smoking_allowed:              boolean;
  interaction_level:            InteractionLevel;
  children_allowed:             boolean;
  music_preference:             MusicPreference;
  seat_preference:              'front' | 'back' | 'any';
  walking_distance_preference:  WalkingDistancePref;
  air_conditioning_preference:  AirConditioningPref;
}

// ── User-side request (extends shared core) ───────────────────────────────────

export interface UserRequest extends CycleRequestCore {
  driver_id?:     string;
  driver_name?:   string;
  driver_rating?: number;
  co_passengers?: CoPassenger[];
}

export interface CoPassenger {
  id:         string;
  first_name: string;
  gender:     'male' | 'female';
}

// ── User profile ──────────────────────────────────────────────────────────────

export interface UserProfile {
  id:              string;
  resetPassword:   boolean;
  name:            string;
  email:           string;
  phone:           string;       // normalised from phone_number
  phone_number?:   string;       // raw API field
  whatsapp_number: string;
  gender:          'male' | 'female' | '';
  date_of_birth:   string;
  avatar_url:      string | null;
  joined_at:       string;
  rating:          number;
  total_cycles:    number;
  active_cycles:   number;
  wallet_balance:  number;
  saved_locations: SavedLocation[];
  gender_pref:     GenderPref;
  walk_minutes:    WalkMinutes;
  seat_preference: 'front' | 'back' | 'any';
  province:        string;
  district:        string;
  sub_district:    string;
  building:        string;
  street:          string;
  landmark:        string;
}

// ── Related Passenger ─────────────────────────────────────────────────────────

export interface RelatedPassenger {
  id:        string;
  name:      string;
  phone?:    string;
  age:       number;
  gender:    'male' | 'female';
  relation?: string;
}

export interface PassengerPayload {
  name:      string;
  phone?:    string;
  age:       number;
  gender:    'male' | 'female';
  relation?: string;
}

export interface SavedLocation {
  id:      string;
  label:   'home' | 'work' | 'custom';
  name:    string;
  address: string;
  lat:     number;
  lng:     number;
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export interface WalletTransaction {
  id:          string;
  type:        'top_up' | 'payment' | 'refund';
  amount:      number;
  description: string;
  date:        string;
  balance:     number;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'payment_required'
  | 'driver_assigned'
  | 'wallet_settled'
  | 'request_matched'
  | 'price_raised'
  | 'request_confirmed'
  | 'cycle_starting_tomorrow'
  | 'cycle_completed'
  | 'payment_deducted'
  | 'refund_issued'
  | 'request_cancelled';

export interface Notification {
  id:         string | number;
  type:       NotificationType;
  title:      string;
  body:       string;
  data:       Record<string, unknown>;
  is_read:    boolean;
  read_at:    string | null;
  created_at: string;
}

export interface NotificationPaginatedResponse {
  success: boolean;
  data: Notification[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
  };
}

export interface UnreadCountResponse {
  success: boolean;
  count: number;
}

// ── Rating ────────────────────────────────────────────────────────────────────

export interface DriverRating {
  cycleId:       string;
  driverId:      string;
  driverName:    string;
  stars:         1 | 2 | 3 | 4 | 5;
  comment?:      string;
  submittedAt?:  string;
}
