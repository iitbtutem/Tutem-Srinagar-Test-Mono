import { ConvexError, v } from "convex/values";
import { internalQuery, query } from "../_generated/server";

export const rideSettings = query({
  handler: async (ctx) => {
    const settings = await ctx.db
    .query("rideSettings")
    .first();
    
    if (settings === null)
      throw new ConvexError(`Ride settings not configured`);

    return settings;
  },
});

export const rideSettingsInternal = internalQuery({
  handler: async (ctx) => {
    const settings = await ctx.db
    .query("rideSettings")
    .first();

    if (settings === null)
      throw new ConvexError(`Ride settings not configured`);

    return settings;
  },
});
