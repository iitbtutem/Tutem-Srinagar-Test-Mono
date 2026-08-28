import { ConvexError } from "convex/values";

/**
 * Calculate age from date of birth string
 * @param dob - Date of birth in string format (e.g., "1990-01-15", "1990/01/15", etc.)
 * @returns Age in years
 */
export function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  
  // Validate that the date is valid
  if (isNaN(birthDate.getTime())) {
    throw new ConvexError("Invalid date of birth format");
  }
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // Adjust age if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Validate user age against configured min/max age restrictions
 * @param dob - Date of birth string
 * @param minAge - Minimum allowed age
 * @param maxAge - Maximum allowed age (optional, null means no upper limit)
 * @param userType - "Driver" or "Rider" for error messages
 * @throws ConvexError if age validation fails
 */
export function validateAge(
  dob: string,
  minAge: number,
  maxAge: number | null | undefined,
  userType: "Driver" | "Rider"
): void {
  const age = calculateAge(dob);
  
  // Always enforce minimum age
  if (age < minAge) {
    throw new ConvexError(
      `${userType} must be at least ${minAge} years old. Current age: ${age}`
    );
  }
  
  // Enforce maximum age only if configured (not null/undefined)
  if (maxAge !== null && maxAge !== undefined && age > maxAge) {
    throw new ConvexError(
      `${userType} must be at most ${maxAge} years old. Current age: ${age}`
    );
  }
}

/**
 * Get age validation settings or throw error if not configured
 * @param ctx - Convex context with database access
 * @returns Age settings or throws error
 */
export async function getAgeSettingsOrThrow(ctx: any) {
  const ageSettings = await ctx.db.query("userAgeSettings").first();
  
  if (!ageSettings) {
    throw new ConvexError(
      "Age validation settings not configured. Please contact administrator."
    );
  }
  
  return ageSettings;
}
