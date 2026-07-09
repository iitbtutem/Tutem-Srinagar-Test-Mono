"use node";

import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
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

// ✅ Export directly — no intermediate variable
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
    await validateSession(ctx, args.sessionToken);

    const ABLY_API_KEY =
      process.env.ABLY_API_KEY || process.env.EXPO_PUBLIC_ABLY_API_KEY;
    if (!ABLY_API_KEY) {
      throw new ConvexError(
        "ABLY_API_KEY not configured in Convex environment",
      );
    }
    const ABLY_URL = process.env.ABLY_URL || process.env.EXPO_PUBLIC_ABLY_URL;
    if (!ABLY_URL) {
      throw new ConvexError("ABLY_URL not configured in Convex environment");
    }

    try {
      const settings = await ctx.runQuery(
        internal.routes.settings.rideSettingsInternal,
      );

      const NearByRadius = settings ? settings.nearbyRadius / METERS_IN_KM : 3;

      const authHeader = `Basic ${btoa(ABLY_API_KEY)}`;
      const response = await fetch(ABLY_URL, {
        headers: { Authorization: authHeader },
      });

      if (!response.ok) return [];

      const presenceSet: any[] = await response.json();

      if (presenceSet.length === 0) return [];

      const nearbyDriversInfo = presenceSet.flatMap((m) => {
        let parsedData = m.data;

        if (typeof m.data === "string") {
          try {
            parsedData = JSON.parse(m.data);
          } catch (e) {
            return [];
          }
        }

        const hasData =
          parsedData &&
          parsedData.latitude !== undefined &&
          parsedData.longitude !== undefined;

        if (!hasData) return [];

        const driver = {
          driverId: parsedData.driverId,
          latitude: Number(parsedData.latitude),
          longitude: Number(parsedData.longitude),
        };

        const dist = haversineDistance(
          Number(args.pickup.latitude),
          Number(args.pickup.longitude),
          driver.latitude,
          driver.longitude,
        );

        const isNearby = dist <= NearByRadius / METERS_IN_KM;

        return isNearby ? [driver] : [];
      });

      if (nearbyDriversInfo.length === 0) return [];

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
