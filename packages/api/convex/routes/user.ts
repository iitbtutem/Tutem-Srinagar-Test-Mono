import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const addUser = mutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    licenseNumber: v.string(),
    organizationId: v.string(),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
  },
  handler: async (ctx, args) => {
    const newUser = await ctx.db.insert("user", args);
    return newUser;
  },
});
