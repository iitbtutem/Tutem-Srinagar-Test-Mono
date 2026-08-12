export const GENDER = ["Male", "Female", "Other"] as const;
export const VEHICLE_TYPE = [
  "Hatchback",
  "Sedan",
  "Suv",
  "Auto",
  "Bike",
] as const;
export const FUEL_TYPE = ["Petrol", "Diesel", "EV"] as const;
export const VEHICLE_CLASS = ["Bike", "Auto", "Cab"] as const;

export const PERMISSIONS = ["Driver", "Rider", "Admin", "Super Admin"] as const;

export const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export const RIDE_OTP_SIZE = 4;
export const OTP_SIZE = 6;
export const OTP_ATTEMPTS = 5;
export const OTP_EXPIRY_MS = 5;
export const MAX_ATTEMPTS = 5;

export const METERS_IN_KM = 1000;
