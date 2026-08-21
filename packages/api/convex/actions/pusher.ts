"use node";

import Pusher from "pusher";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Pusher Server SDK singleton
// ---------------------------------------------------------------------------

let _pusher: Pusher | null = null;

export function getPusher(): Pusher {
  if (!_pusher) {
    const appId =
      process.env.PUSHER_APP_ID ||
      process.env.EXPO_PUBLIC_PUSHER_APP_ID;
    const key =
      process.env.PUSHER_APP_KEY ||
      process.env.EXPO_PUBLIC_PUSHER_APP_KEY ||
      process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
    const secret =
      process.env.PUSHER_APP_SECRET ||
      process.env.EXPO_PUBLIC_PUSHER_APP_SECRET;
    const cluster =
      process.env.PUSHER_CLUSTER ||
      process.env.EXPO_PUBLIC_PUSHER_CLUSTER ||
      process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!appId || !key || !secret || !cluster) {
      throw new Error(
        "Pusher credentials missing. Set PUSHER_APP_ID, PUSHER_APP_KEY, PUSHER_APP_SECRET, PUSHER_CLUSTER in Convex env vars."
      );
    }

    _pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
  }
  return _pusher;
}

// ---------------------------------------------------------------------------
// Server-side location cache
//
// WHY: Pusher is a pub/sub broker — it does NOT store message history or
// coordinates. We need coordinates for the Haversine filter in getNearbyDrivers.
//
// HOW: This cache is updated ONLY by the 60-second heartbeat from each driver
// (not on every GPS tick). It is cross-referenced with Pusher's live channel
// list so stale entries (driver disconnected) are never returned.
//
// SCALE NOTE: Module-level vars persist within a single Convex worker process.
// On worker restart, cache is empty until drivers send their next heartbeat
// (max 60s). For the scale of a city-level ride-sharing app this is fine.
// ---------------------------------------------------------------------------

export interface CachedDriverLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  isAvailable: boolean;
  ts: number;
}

export const locationCache = new Map<string, CachedDriverLocation>();
const STALE_MS = 120_000; // evict if no heartbeat for 2 minutes

export function cacheDriverLocation(entry: CachedDriverLocation): void {
  locationCache.set(entry.driverId, entry);
}

export function getCachedLocation(driverId: string): CachedDriverLocation | undefined {
  return locationCache.get(driverId);
}

export function evictStaleEntries(): void {
  const now = Date.now();
  for (const [id, entry] of locationCache.entries()) {
    if (now - entry.ts > STALE_MS) locationCache.delete(id);
  }
}

// ---------------------------------------------------------------------------
// Convex Actions
// ---------------------------------------------------------------------------

/**
 * Authorize a Pusher private/presence channel subscription.
 *
 * For presence channels, reads lat/lng from the request params (sent by the
 * native SDK as part of the auth POST body) so they are embedded in user_info.
 * This lets presence member data carry the driver's approximate location.
 */
export const authorizeChannel = action({
  args: {
    socketId: v.string(),
    channelName: v.string(),
    driverId: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (_ctx, { socketId, channelName, driverId, latitude, longitude }) => {
    const isAllowed =
      channelName.startsWith("private-") ||
      channelName.startsWith("presence-");

    if (!isAllowed) throw new Error("Unauthorized channel");

    const pusher = getPusher();

    if (channelName.startsWith("presence-")) {
      const uid = driverId || socketId;
      return pusher.authorizeChannel(socketId, channelName, {
        user_id: uid,
        user_info: {
          driverId: uid,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
        },
      });
    }

    return pusher.authorizeChannel(socketId, channelName);
  },
});

/**
 * Trigger a driver location update on Pusher.
 *
 * Called by:
 *   - Driver app heartbeat (every 60s) when native Pusher is active
 *   - Driver app on every GPS tick when native Pusher is NOT available
 *   - Background location task (tasks.ts)
 *
 * Does two things:
 *   1. Broadcasts the location to private-driver-location-{driverId}
 *      so rider app and admin web receive it directly from Pusher.
 *   2. Updates the server-side location cache (for getNearbyDrivers).
 */
export const triggerDriverLocation = action({
  args: {
    driverId: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    heading: v.optional(v.union(v.number(), v.null())),
    speed: v.optional(v.union(v.number(), v.null())),
    timestamp: v.optional(v.number()),
    isAvailable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = args.timestamp ?? Date.now();

    // 1. Update server-side cache (used by getNearbyDrivers)
    cacheDriverLocation({
      driverId: args.driverId,
      latitude: args.latitude,
      longitude: args.longitude,
      isAvailable: args.isAvailable ?? true,
      ts: now,
    });
    evictStaleEntries();

    // 2. Broadcast to Pusher — rider/admin receive this directly from Pusher
    const pusher = getPusher();
    await pusher.trigger(
      `private-driver-location-${args.driverId}`,
      "client-locationUpdate",
      {
        driverId: args.driverId,
        latitude: args.latitude,
        longitude: args.longitude,
        heading: args.heading ?? null,
        speed: args.speed ?? null,
        timestamp: now,
      }
    );

    console.log(`[pusher] 📍 trigger + cache for driver ${args.driverId}`);

    // 3. Stale-mode correction: the background task (tasks.ts) stores
    //    locationMode in SecureStore. If admin cleared a ride while the app
    //    was backgrounded, the task still fires in 'on-ride' mode even though
    //    the driver is now free. Detect this server-side and upsert the driver's
    //    location into availableDriverLocation so they're discoverable for new
    //    ride requests and visible on the tracking page's Convex live query.
    try {
      const driverId = args.driverId as any; // Id<"driver">
      const hasRide = await ctx.runQuery(
        internal.routes.driverLocation.driverHasActiveRide,
        { driverId }
      );

      if (!hasRide) {
        // Driver is free but background task thinks they're on-ride.
        // Write to DB so they appear in the available pool.
        await ctx.runMutation(
          internal.routes.driverLocation.upsertAvailableDriverLocation,
          {
            driverId,
            latitude: args.latitude,
            longitude: args.longitude,
          }
        );
        console.log(
          `[pusher] 🔄 Stale on-ride mode detected for ${args.driverId} — upserted to availableDriverLocation.`
        );
      }
    } catch (e) {
      // Non-fatal: Pusher broadcast succeeded; DB sync is best-effort.
      console.warn(`[pusher] ⚠️ Available-location sync failed for ${args.driverId}:`, e);
    }

    return { success: true };
  },
});

export const triggerInternalDriverLocation = internalAction({
  args: {
    driverId: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    heading: v.optional(v.union(v.number(), v.null())),
    speed: v.optional(v.union(v.number(), v.null())),
    timestamp: v.optional(v.number()),
    isAvailable: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    const now = args.timestamp ?? Date.now();

    cacheDriverLocation({
      driverId: args.driverId,
      latitude: args.latitude,
      longitude: args.longitude,
      isAvailable: args.isAvailable ?? true,
      ts: now,
    });
    evictStaleEntries();

    const pusher = getPusher();
    await pusher.trigger(
      `private-driver-location-${args.driverId}`,
      "client-locationUpdate",
      {
        driverId: args.driverId,
        latitude: args.latitude,
        longitude: args.longitude,
        heading: args.heading ?? null,
        speed: args.speed ?? null,
        timestamp: now,
      }
    );

    return { success: true };
  },
});

/**
 * Read the latest cached driver location.
 *
 * Called by the rider app polling fallback via GET /api/pusher/driver-location?driverId=...
 * Returns null if no location has been cached yet (driver hasn't sent a heartbeat).
 */
export const getDriverLocation = action({
  args: {
    driverId: v.string(),
  },
  handler: async (_ctx, { driverId }) => {
    const cached = getCachedLocation(driverId);
    if (!cached) return { success: true, location: null };
    return {
      success: true,
      location: {
        driverId: cached.driverId,
        latitude: cached.latitude,
        longitude: cached.longitude,
        timestamp: cached.ts,
      },
    };
  },
});
