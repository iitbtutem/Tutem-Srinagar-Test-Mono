import { ConvexError, v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { adminMutation, authenticatedQuery } from "../helpers/sessionFunctions";

export const rideSettings = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("rideSettings").first();

    return settings;
  },
});

export const addRideSettings = adminMutation({
  args: {
    nearbyRadius: v.number(),
    arrivedDistance: v.number(),
    driverResponseTime: v.number(),
    maxDriverRideRequests: v.optional(v.number()),
    cancellationPenalty: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("rideSettings").first();
    if (settings) {
      await ctx.db.patch(settings._id, args);
    } else {
      await ctx.db.insert("rideSettings", args);
    }
  },
});

export const updateRideSettings = adminMutation({
  args: {
    id: v.id("rideSettings"),
    nearbyRadius: v.number(),
    arrivedDistance: v.number(),
    driverResponseTime: v.number(),
    maxDriverRideRequests: v.optional(v.number()),
    cancellationPenalty: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.get(args.id);
    if (!settings) {
      throw new ConvexError("Settings not found");
    }
    await ctx.db.patch(args.id, args);
  },
});

export const rideSettingsInternal = internalQuery({
  handler: async (ctx) => {
    const settings = await ctx.db.query("rideSettings").first();

    return settings;
  },
});
