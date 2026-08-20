"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { NearbyDriverResult } from "../routes/rides";
import { METERS_IN_KM } from "../CONSTANTS";
import { validateSession } from "../helpers/sessionFunctions";


type ReturnValue = NearbyDriverResult[];

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const getNearbyDrivers = action({
  args: {
    sessionToken: v.string(),
    pickup: v.object({
      latitude: v.number(),
      longitude: v.number(),
    }),
    destination: v.object({
      latitude: v.number(),
      longitude: v.number(),
    }),
    riderId: v.id("rider"),
    distance: v.number(),
    genderMatch: v.boolean(),
    filters: v.array(
      v.union(v.literal("Bike"), v.literal("Cab"), v.literal("Auto")),
    ),
  },
  handler: async (ctx, args): Promise<ReturnValue> => {
    // Validate session
    await validateSession(ctx, args.sessionToken, "Rider");

    try {
      const settings = await ctx.runQuery(
        internal.routes.settings.rideSettingsInternal,
      );

      const nearByRadiusInKms = settings
        ? settings.nearbyRadius / METERS_IN_KM
        : 3;

      console.log("nearbyRadius:", nearByRadiusInKms);

      // Query fresh driver locations from Convex DB.
      // Stale entries (updatedAt > 35s ago) are already filtered server-side.
      const activeLocations = await ctx.runQuery(
        internal.routes.driverLocation.getActiveDriverLocations,
      );

      if (activeLocations.length === 0) {
        console.log(
          "[getNearbyDrivers] No active driver locations in DB.",
        );
        return [];
      }

      console.log(
        `[getNearbyDrivers] Checking ${activeLocations.length} active driver(s) from DB`,
      );

      // Filter by Haversine distance from the pickup point
      const nearbyDriversInfo: {
        driverId: Id<"driver">;
        latitude: number;
        longitude: number;
      }[] = [];

      for (const loc of activeLocations) {
        const dist = haversineDistance(
          Number(args.pickup.latitude),
          Number(args.pickup.longitude),
          loc.latitude,
          loc.longitude,
        );

        if (dist <= nearByRadiusInKms) {
          nearbyDriversInfo.push({
            driverId: loc.driverId,
            latitude: loc.latitude,
            longitude: loc.longitude,
          });
        }
      }

      if (nearbyDriversInfo.length === 0) {
        console.log("[getNearbyDrivers] No active drivers within radius.");
        return [];
      }

      console.log(
        `[getNearbyDrivers] ${nearbyDriversInfo.length} driver(s) within ${nearByRadiusInKms} km`,
      );

      const result = await ctx.runQuery(
        internal.routes.rides.getNearbyDriversQueryResultInternal,
        {
          driversInfo: nearbyDriversInfo,
          genderMatch: args.genderMatch,
          filters: args.filters,
          distance: args.distance,
          riderId: args.riderId,
        },
      );

      return result;
    } catch (error) {
      console.error("Discovery action failed:", error);
      return [];
    }
  },
});

