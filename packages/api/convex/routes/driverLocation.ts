import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { driverMutation, adminQuery } from "../helpers/sessionFunctions";

// Entries older than this are considered stale and excluded from getNearbyDrivers.
const STALE_MS = 61_000;

/**
 * Internal query: does this driver currently have an active ride?
 *
 * Used by triggerDriverLocation to detect the "admin cleared ride while app
 * was backgrounded" scenario — where the background task still runs in
 * on-ride mode but the driver is actually free.
 *
 * Returns true if a non-terminal ride row exists for the driver.
 */
export const driverHasActiveRide = internalQuery({
  args: { driverId: v.id("driver") },
  handler: async (ctx, { driverId }) => {
    const ride = await ctx.db
      .query("ride")
      .withIndex("by_driver", (q) => q.eq("driverId", driverId))
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "Completed"),
          q.neq(q.field("status"), "Canceled"),
          q.neq(q.field("status"), "Abort"),
        ),
      )
      .first();
    return ride !== null;
  },
});

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
    speed: v.optional(v.number()),
    heading: v.optional(v.number()),
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
        speed: args.speed,
        heading: args.heading,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("availableDriverLocation", {
        driverId: args.driverId,
        latitude: args.latitude,
        longitude: args.longitude,
        speed: args.speed,
        heading: args.heading,
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

/**
 * Fetch the latest stored location for a specific driver.
 * Used by the HTTP polling fallback (GET /api/pusher/driver-location).
 * Returns null if the driver has no recorded location.
 */
export const getDriverLocationById = internalQuery({
  args: { driverId: v.id("driver") },
  handler: async (ctx, { driverId }) => {
    const loc = await ctx.db
      .query("availableDriverLocation")
      .withIndex("by_driver", (q) => q.eq("driverId", driverId))
      .first();
    if (!loc) return null;
    return {
      driverId: loc.driverId,
      latitude: loc.latitude,
      longitude: loc.longitude,
      timestamp: loc.updatedAt,
    };
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
    speed: v.optional(v.number()),
    heading: v.optional(v.number()),
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
        speed: args.speed,
        heading: args.heading,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("availableDriverLocation", {
        driverId: args.driverId,
        latitude: args.latitude,
        longitude: args.longitude,
        speed: args.speed,
        heading: args.heading,
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
        speed: loc.speed,
        heading: loc.heading,
        updatedAt: loc.updatedAt,
      }));
  },
});
