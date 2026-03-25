import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const addDriver = mutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    licenseNumber: v.string(),
    organizationId: v.id("organization"),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
    phoneNumber: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (existingUser) {
      throw new Error("User already exists");
    }

    const newUser = await ctx.db.insert("user", { ...args, type: "Driver" });

    return newUser;
  },
});

export const addRider = mutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
    phoneNumber: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (existingUser) {
      throw new Error("User already exists");
    }

    const newUser = await ctx.db.insert("user", { ...args, type: "Rider" });

    return newUser;
  },
});

export const getUser = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (existingUser === null) throw new Error("User not found");

    const organization = await ctx.db
      .query("organization")
      .filter((q) => q.eq(q.field("_id"), existingUser.organizationId))
      .first()

    return { ...existingUser, organization: organization };
  },
});

export const updateUser = mutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    licenseNumber: v.string(),
    organizationId: v.id("organization"),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
    phoneNumber: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
      dob: args.dob,
      licenseNumber: args.licenseNumber,
      organizationId: args.organizationId,
      gender: args.gender,
      phoneNumber: args.phoneNumber,
    });
  },
});
