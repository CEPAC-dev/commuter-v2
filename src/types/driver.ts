import type { CycleRequestCore } from './shared';

export type {
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
  PickupPoint,
  CycleRequestCore,
} from './shared';

// ── Driver-side request (extends shared core) ─────────────────────────────────

export interface DriverCycleRequest extends CycleRequestCore {
  driver_id?:     string;
  driver_name?:   string;
  driver_rating?: number;
}

// ── Driver profile ────────────────────────────────────────────────────────────

export interface DriverProfile {
  id:                   string;
  name:                 string;
  phone:                string;
  email:                string;
  address:              string;
  nationalId:           string;
  drivingLicenseNumber: string;
  carLicensePlate:      string;
  carModel:             string;
  carYear:              number;
  carColor:             string;
  rating:               number;
  totalTrips:           number;
  walletBalance:        number;
  joinedAt:             string;
  documents:            DriverDocuments;
  isVerified:           boolean;
  completedCycles:      number;
  activeCycles:         number;
  gender:               'male' | 'female';
}

export interface DriverDocuments {
  nationalIdFront:  string | null;
  nationalIdBack:   string | null;
  drivingLicense:   string | null;
  carLicenseFront:  string | null;
  carLicenseBack:   string | null;
  criminalRecord:   string | null;
  profilePhoto:     string | null;
}

// ── Driver profile from /me endpoint ──────────────────────────────────────────

export interface DriverProfileMeData {
  id: number;
  user_id: number;
  national_id: string | null;
  license_expiry: string | null;
  car_type: string | null;
  car_brand: string | null;
  car_model: string | null;
  car_year: string | number | null;
  car_color: string | null;
  license_plate: string | null;
  car_capacity: number | null;
  location_name: string | null;
  default_lng: number | null;
  default_lat: number | null;
  price_per_km: string | number | null;
  waiting_price_per_hour: string | number | null;
  waiting_time?: number | null;  // Sometimes in API responses
  passenger_type: string | null;
  seats?: number | null;  // Sometimes in API responses
  passenger_gender?: string | null;  // Sometimes in API responses
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  // image URL fields returned by API
  profile_photo_url: string | null;
  national_id_image_front_url: string | null;
  national_id_image_back_url: string | null;
  driving_license_url: string | null;
  vehicle_license_front_url: string | null;
  vehicle_license_back_url: string | null;
  criminal_record_certificate_url: string | null;
}

export type RequestAction = 'accept' | 'raise' | 'reject';
export type RaiseOption   = 5 | 10 | 15 | 'custom';
