import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { NearbyDriverResult } from "./rides";

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

const RADIUS_KM = 5;
const METERS_IN_KM = 1000;

// ✅ Export directly — no intermediate variable
export const getNearbyDrivers = action({
  args: {
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
  handler: async (ctx, args) : Promise<ReturnValue> => {
    const ABLY_API_KEY = process.env.ABLY_API_KEY || process.env.EXPO_PUBLIC_ABLY_API_KEY;
    if (!ABLY_API_KEY) {
      throw new Error("ABLY_API_KEY not configured in Convex environment");
    }

    try {
      const authHeader = `Basic ${btoa(ABLY_API_KEY)}`;
      const response = await fetch(
        "https://rest.ably.io/channels/global:active-drivers/presence",
        { headers: { Authorization: authHeader } }
      );

      if (!response.ok) {
        console.error("Ably Presence API error:", await response.text());
        return [];
      }

      const presenceSet: any[] = await response.json();
      console.log("Raw Presence Set from Ably:", presenceSet);

      const nearbyDriversInfo = presenceSet
        .map((m) => {
          // Ably data can sometimes arrive as a stringified JSON
          let parsedData = m.data;
          if (typeof m.data === "string") {
            try {
              parsedData = JSON.parse(m.data);
            } catch (e) {
              console.error("Failed to parse presence data:", m.data);
              return null;
            }
          }
          return { ...m, parsedData };
        })
        .filter((m) => {
          if (!m) return false;
          const hasData = m.parsedData && m.parsedData.latitude !== undefined && m.parsedData.longitude !== undefined;
          if (!hasData) console.log("Member filtered out (no lat/lng):", m.clientId, m.data);
          return hasData;
        })
        .map((m) => ({
          driverId: m!.parsedData.driverId,
          latitude: Number(m!.parsedData.latitude),
          longitude: Number(m!.parsedData.longitude),
        }))
        .filter((driver) => {
          const dist = haversineDistance(
            Number(args.pickup.latitude),
            Number(args.pickup.longitude),
            driver.latitude,
            driver.longitude
          );
          const isNearby = dist <= RADIUS_KM;
          console.log(`Driver ${driver.driverId} distance: ${dist.toFixed(3)}km. Nearby: ${isNearby}`);
          return isNearby;
        });


      console.log("Final nearbyDrivers list:", nearbyDriversInfo);


      console.log("nearbyDrivers info",nearbyDriversInfo);

      if (nearbyDriversInfo.length === 0) return [];

      const result = await ctx.runQuery(internal.routes.rides.getNearbyDriversQueryResult, {
          driversInfo: nearbyDriversInfo,
          genderMatch: args.genderMatch,
          filters: args.filters,
          distance: args.distance,
          riderId: args.riderId,
        }
      );

      return result;
    } catch (error) {
      console.error("Discovery action failed:", error);
      return [];
    }
  },
});