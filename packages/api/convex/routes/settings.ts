import { ConvexError, v } from "convex/values";
import { internalQuery, query } from "../_generated/server";
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

// User Age Settings

export const getUserAgeSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("userAgeSettings").first();
    if (!settings) return null;

    return {
      ...settings,
      maxDriverAge: settings.maxDriverAge ?? null,
      maxRiderAge: settings.maxRiderAge ?? null,
    };
  },
});

export const setUserAgeSettings = adminMutation({
  args: {
    minDriverAge: v.number(),
    maxDriverAge: v.optional(v.number()),
    minRiderAge: v.number(),
    maxRiderAge: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate min/max age logic
    if (
      args.maxDriverAge !== undefined &&
      args.maxDriverAge <= args.minDriverAge
    ) {
      throw new ConvexError(
        "Maximum driver age must be greater than minimum driver age",
      );
    }
    if (
      args.maxRiderAge !== undefined &&
      args.maxRiderAge <= args.minRiderAge
    ) {
      throw new ConvexError(
        "Maximum rider age must be greater than minimum rider age",
      );
    }
    if (args.minDriverAge < 1 || args.minDriverAge > 150) {
      throw new ConvexError("Minimum driver age must be between 1 and 150");
    }
    if (args.minRiderAge < 1 || args.minRiderAge > 150) {
      throw new ConvexError("Minimum rider age must be between 1 and 150");
    }
    if (
      args.maxDriverAge !== undefined &&
      (args.maxDriverAge < 1 || args.maxDriverAge > 150)
    ) {
      throw new ConvexError("Maximum driver age must be between 1 and 150");
    }
    if (
      args.maxRiderAge !== undefined &&
      (args.maxRiderAge < 1 || args.maxRiderAge > 150)
    ) {
      throw new ConvexError("Maximum rider age must be between 1 and 150");
    }

    const settings = await ctx.db.query("userAgeSettings").first();
    if (settings) {
      await ctx.db.patch(settings._id, args);
    } else {
      await ctx.db.insert("userAgeSettings", args);
    }
  },
});

export const userAgeSettingsInternal = internalQuery({
  handler: async (ctx) => {
    const settings = await ctx.db.query("userAgeSettings").first();

    return settings;
  },
});
