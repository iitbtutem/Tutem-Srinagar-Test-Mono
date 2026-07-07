import { ConvexError, v } from "convex/values";
import { internalQuery, query } from "../_generated/server";
import { authenticatedMutation } from "../helpers/sessionFunctions";

export const rideSettings = query({
  handler: async (ctx) => {
    const settings = await ctx.db.query("rideSettings").first();

    return settings;
  },
});

export const addRideSettings = authenticatedMutation({
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

export const rideSettingsInternal = internalQuery({
  handler: async (ctx) => {
    const settings = await ctx.db.query("rideSettings").first();

    return settings;
  },
});
