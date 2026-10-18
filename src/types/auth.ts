export type UserRole = 'driver' | 'user';

export interface AuthResponse {
  token: string;
  role: UserRole;
  userId: string;
  name: string;
  isVerified: boolean;
  isApproved: boolean; // drivers only — false until admin approves
}

export interface UserSignInPayload {
  email: string;
  password: string;
}

export interface UserSignUpPayload {
  role:                 'user';
  name:                 string;
  email:                string;
  phone_number:         string;
  whatsapp_number:      string;
  province:             string;
  district:             string;
  sub_district:         string;
  building:             string;
  street:               string;
  landmark:             string;
  password:             string;
  password_confirmation: string;
}

export interface DriverSignInPayload {
  email: string;
  password: string;
}

export interface DriverSignUpPayload {
  // Step 1
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  address: string;
  nationalId: string;
  dateOfBirth: string;
  // Step 2
  carBrand: string;
  carModel: string;
  carYear: number;
  carColor: string;
  licensePlate: string;
  drivingLicenseNumber: string;
  // Step 3 — all required
  documents: {
    profilePhoto: File;
    nationalIdFront: File;
    nationalIdBack: File;
    drivingLicense: File;
    carLicense: File;
    criminalRecord: File;
  };
}

// Keep legacy aliases for existing driver portal code
export type SignInPayload      = UserSignInPayload;
export type UserSignupPayload  = UserSignUpPayload;
export type DriverSignupPayload = DriverSignUpPayload;
export interface DriverSignupStep {
  step: 1 | 2 | 3;
  label: string;
  description: string;
}
