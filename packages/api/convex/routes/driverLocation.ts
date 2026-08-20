import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { driverMutation, adminQuery } from "../helpers/sessionFunctions";

// Entries older than this are considered stale and excluded from getNearbyDrivers.
const STALE_MS = 35_000;

/**
 * Upsert a driver's available location.
 * Called when driver is online + available for rides.
 * One row per driver — existing row is updated, new row is inserted if absent.
 */
export const upsertAvailableDriverLocation = internalMutation({
  args: {
    driverId: v.id("driver"),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("availableDriverLocation")
      .withIndex("by_driver", (q) => q.eq("driverId", args.driverId))
      .first();

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        latitude: args.latitude,
        longitude: args.longitude,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("availableDriverLocation", {
        driverId: args.driverId,
        latitude: args.latitude,
        longitude: args.longitude,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Delete a driver's available location record.
 * Called when driver goes offline, unavailable, or starts a ride.
 */
export const deleteAvailableDriverLocation = internalMutation({
  args: {
    driverId: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("availableDriverLocation")
      .withIndex("by_driver", (q) => q.eq("driverId", args.driverId))
      .first();

    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Return all active (non-stale) driver locations.
 * Filters out entries not updated within the last STALE_MS milliseconds.
 * Used by getNearbyDrivers action to find candidates before Haversine filtering.
 */
export const getActiveDriverLocations = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_MS;
    const allLocations = await ctx.db
      .query("availableDriverLocation")
      .collect();

    return allLocations.filter((loc) => loc.updatedAt >= cutoff);
  },
});

// ---------------------------------------------------------------------------
// Public SDK-callable mutations (foreground use via Convex React Native client)
//
// These share the exact same DB logic as the internal mutations above but are
// exposed as public driverMutation — authenticated via session token.
// Called directly from useLocationManager.ts (no HTTP round-trip needed).
//
// The internal mutations above are kept for the background task (tasks.ts)
// which runs in headless JS and can only reach Convex via plain fetch().
// ---------------------------------------------------------------------------

/**
 * Public upsert — called by the foreground location hook via Convex SDK.
 * Requires a valid Driver session token.
 */
export const upsertAvailableDriverLocationSDK = driverMutation({
  args: {
    driverId: v.id("driver"),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("availableDriverLocation")
      .withIndex("by_driver", (q) => q.eq("driverId", args.driverId))
      .first();

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        latitude: args.latitude,
        longitude: args.longitude,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("availableDriverLocation", {
        driverId: args.driverId,
        latitude: args.latitude,
        longitude: args.longitude,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Public delete — called by the foreground location hook via Convex SDK.
 * Requires a valid Driver session token.
 */
export const deleteAvailableDriverLocationSDK = driverMutation({
  args: {
    driverId: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("availableDriverLocation")
      .withIndex("by_driver", (q) => q.eq("driverId", args.driverId))
      .first();

    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
  },
});

// ---------------------------------------------------------------------------
// Public admin query for the web tracking dashboard
//
// Available drivers (not on a ride) send their location to Convex DB —
// they no longer broadcast via Pusher. The tracking page calls this query
// to seed those driver locations. On-ride drivers still come via Pusher
// (unchanged). The tracking page merges both sources.
//
// Returns the minimal shape needed: driverId + coords + recency timestamp.
// Driver profile info is already loaded separately via getAllDrivers.
//
// Stale entries (>35s old) are excluded so the map auto-cleans when
// a driver goes offline without explicitly deleting their record.
// ---------------------------------------------------------------------------
export const getAvailableDriverLocations = adminQuery({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_MS;
    const all = await ctx.db.query("availableDriverLocation").collect();
    return all
      .filter((loc) => loc.updatedAt >= cutoff)
      .map((loc) => ({
        driverId: loc.driverId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        updatedAt: loc.updatedAt,
      }));
  },
});
