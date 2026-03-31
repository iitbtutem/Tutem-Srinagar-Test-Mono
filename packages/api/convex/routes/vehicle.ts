import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { FUEL_TYPE, VEHICLE_CLASS, VEHICLE_TYPE } from "../CONSTANTS";

export const getVehicleByUserId = query({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db
      .query("vehicle")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .first();

    return vehicle;
  },
});

export const addVehicle = mutation({
  args: {
    registrationNumber: v.string(),
    model: v.string(),
    type: v.union(...VEHICLE_TYPE.map((type) => v.literal(type))),
    fuelType: v.union(...FUEL_TYPE.map((type) => v.literal(type))),
    class: v.union(...VEHICLE_CLASS.map((type) => v.literal(type))),
    color: v.string(),
    seatingCapacity: v.number(),
    ownerId: v.id("user"),
    rcImageKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.seatingCapacity < 2 || args.seatingCapacity > 50)
      throw new ConvexError("Invalid seating capacity");

    const user = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("_id"), args.ownerId))
      .first();

    if (user === null) throw new ConvexError("User not found.");

    if (args.rcImageKey === undefined) {
      const organization = await ctx.db
        .query("organization")
        .filter((q) => q.eq(q.field("_id"), user.organizationId))
        .first();

      if (organization === undefined)
        throw new ConvexError("User not assigned organization.");

      if (organization?.isVehicleRegistrationRequired)
        throw new ConvexError("RC image required.");
    }

    const existingVehicle = await ctx.db
      .query("vehicle")
      .filter((q) =>
        q.eq(q.field("registrationNumber"), args.registrationNumber),
      )
      .first();

    if (existingVehicle) {
      throw new Error("Vehicle already exists");
    }

    const newVehicle = await ctx.db.insert("vehicle", args);

    return newVehicle;
  },
});

export const updateVehicle = mutation({
  args: {
    id: v.id("vehicle"),
    registrationNumber: v.string(),
    model: v.string(),
    type: v.union(...VEHICLE_TYPE.map((type) => v.literal(type))),
    fuelType: v.union(...FUEL_TYPE.map((type) => v.literal(type))),
    class: v.union(...VEHICLE_CLASS.map((type) => v.literal(type))),
    color: v.string(),
    seatingCapacity: v.number(),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});
