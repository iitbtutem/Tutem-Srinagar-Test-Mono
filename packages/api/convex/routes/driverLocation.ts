import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { driverMutation, adminQuery } from "../helpers/sessionFunctions";
import type { DatabaseReader, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// Entries older than this are considered stale and excluded from getNearbyDrivers.
const STALE_MS = 61_000;

async function trackingMode(db: DatabaseReader, driverId: Id<"driver">) {
  const driver = await db.get(driverId);
  if (!driver?.isOnline) return "offline" as const;
  const ride = await db
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
  return ride !== null ? ("on-ride" as const) : ("available" as const);
}

// Use server state even when the app's cached ride state is stale.
export const driverTrackingMode = internalQuery({
  args: { driverId: v.id("driver") },
  handler: (ctx, { driverId }) => trackingMode(ctx.db, driverId),
});

const locationArgs = {
  driverId: v.id("driver"),
  latitude: v.number(),
  longitude: v.number(),
  speed: v.optional(v.number()),
  heading: v.optional(v.number()),
  timestamp: v.optional(v.number()),
};

async function saveAvailableLocation(
  ctx: MutationCtx,
  args: {
    driverId: Id<"driver">;
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
    timestamp?: number;
  },
) {
  // Recheck inside the transaction: an in-flight update may arrive after
  // acceptance or going offline. Such an update must not write a DB location.
  if ((await trackingMode(ctx.db, args.driverId)) !== "available") return;
  const existing = await ctx.db
    .query("availableDriverLocation")
    .withIndex("by_driver", (q) => q.eq("driverId", args.driverId))
    .first();
  const updatedAt = Math.min(args.timestamp ?? Date.now(), Date.now());
  if (existing && existing.updatedAt > updatedAt) return;
  const location = {
    latitude: args.latitude,
    longitude: args.longitude,
    speed: args.speed,
    heading: args.heading,
    updatedAt,
  };
  if (existing) await ctx.db.patch(existing._id, location);
  else
    await ctx.db.insert("availableDriverLocation", {
      driverId: args.driverId,
      ...location,
    });
}

/**
 * Upsert a driver's available location.
 * Called when driver is online + available for rides.
 * One row per driver — existing row is updated, new row is inserted if absent.
 */
export const upsertAvailableDriverLocation = internalMutation({
  args: locationArgs,
  handler: saveAvailableLocation,
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
  args: locationArgs,
  handler: saveAvailableLocation,
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
