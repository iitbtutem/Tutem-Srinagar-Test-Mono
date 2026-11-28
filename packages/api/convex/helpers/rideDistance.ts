import { ConvexError } from "convex/values";

export function validateRideDistanceLimits(
  minimum: number,
  maximum: number,
): void {
  if (
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    minimum <= 0 ||
    maximum <= minimum
  ) {
    throw new ConvexError(
      "Route distances must be positive, with minimum below maximum",
    );
  }
}

export function validateRideDistance(
  distance: number,
  settings: { minimumRideDistance?: number; maximumRideDistance?: number } | null,
): void {
  if (
    settings?.minimumRideDistance === undefined ||
    settings.maximumRideDistance === undefined
  ) {
    throw new ConvexError("Ride distance settings are not configured");
  }
  validateRideDistanceLimits(settings.minimumRideDistance, settings.maximumRideDistance);
  if (
    !Number.isFinite(distance) ||
    distance < settings.minimumRideDistance ||
    distance > settings.maximumRideDistance
  ) {
    throw new ConvexError(
      `Trip distance must be between ${settings.minimumRideDistance} and ${settings.maximumRideDistance} meters`,
    );
  }
}
