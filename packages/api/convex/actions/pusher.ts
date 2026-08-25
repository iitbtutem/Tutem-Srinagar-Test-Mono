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
 * Unified driver location handler.
 *
 * Called by:
 *   - Driver app foreground (when native Pusher is NOT available)
 *   - Background location task (tasks.ts) — always
 *
 * Routing logic (server-side):
 *   - If driver has an active ride → broadcast to Pusher (real-time tracking)
 *   - If driver is available (no ride) → upsert to Convex DB (nearby driver discovery)
 *
 * The server checks the driver's current state (hasActiveRide) to determine routing.
 * This eliminates the need to store locationMode in SecureStore on the client.
 */
export const triggerDriverLocation = action({
  args: {
    driverId: v.id("driver"),
    latitude: v.number(),
    longitude: v.number(),
    heading: v.optional(v.union(v.number(), v.null())),
    speed: v.optional(v.union(v.number(), v.null())),
    timestamp: v.optional(v.number()),
    isAvailable: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; mode: "on-ride" | "available" }> => {
    const now = args.timestamp ?? Date.now();
    const driverId = args.driverId;

    // 1. Check if driver has an active ride (server-side routing decision)
    const hasRide = await ctx.runQuery(
      internal.routes.driverLocation.driverHasActiveRide,
      { driverId }
    );

    if (hasRide) {
      // ─── ON-RIDE MODE: Broadcast to Pusher + persist to DB ───────────────────

      // Keep DB up-to-date so the HTTP polling fallback can read it from DB
      // instead of relying on the removed in-process cache.
      await ctx.runMutation(
        internal.routes.driverLocation.upsertAvailableDriverLocation,
        {
          driverId,
          latitude: args.latitude,
          longitude: args.longitude,
          speed: args.speed ?? undefined,
          heading: args.heading ?? undefined,
        }
      );

      // Broadcast to Pusher — rider/admin receive this directly from Pusher
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

      console.log(`[pusher] 📍 ON-RIDE: Broadcast to Pusher + upserted to DB for driver ${args.driverId}`);
    } else {
      // ─── AVAILABLE MODE: Upsert to Convex DB ─────────────────────────────────

      await ctx.runMutation(
        internal.routes.driverLocation.upsertAvailableDriverLocation,
        {
          driverId,
          latitude: args.latitude,
          longitude: args.longitude,
          speed: args.speed ?? undefined,
          heading: args.heading ?? undefined,
        }
      );

      console.log(`[pusher] 📍 AVAILABLE: Upserted to DB for driver ${args.driverId}`);
    }

    return { success: true, mode: hasRide ? 'on-ride' : 'available' };
  },
});

export const triggerInternalDriverLocation = internalAction({
  args: {
    driverId: v.id("driver"),
    latitude: v.number(),
    longitude: v.number(),
    heading: v.optional(v.union(v.number(), v.null())),
    speed: v.optional(v.union(v.number(), v.null())),
    timestamp: v.optional(v.number()),
    isAvailable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = args.timestamp ?? Date.now();
    const driverId = args.driverId;

    // Persist to DB so polling fallback has a reliable source of truth
    await ctx.runMutation(
      internal.routes.driverLocation.upsertAvailableDriverLocation,
      {
        driverId,
        latitude: args.latitude,
        longitude: args.longitude,
      }
    );

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
 * Read the latest driver location from the DB.
 *
 * Called by the rider app polling fallback via GET /api/pusher/driver-location?driverId=...
 * Returns null if the driver has no recorded location.
 */
export const getDriverLocation = action({
  args: {
    driverId: v.id("driver"),
  },
  handler: async (ctx, { driverId }): Promise<{
    success: boolean;
    location: {
      driverId: string;
      latitude: number;
      longitude: number;
      timestamp: number;
    } | null;
  }> => {
    const location = await ctx.runQuery(
      internal.routes.driverLocation.getDriverLocationById,
      { driverId }
    );
    return { success: true, location };
  },
});
