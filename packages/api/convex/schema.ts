import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users
  user: defineTable({
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    licenseNumber: v.optional(v.string()),
    licenseImageFrontKey: v.optional(v.string()),
    licenseImageBackKey: v.optional(v.string()),
    organizationId: v.optional(v.id("organization")),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
    type: v.union(v.literal("Driver"), v.literal("Rider"), v.literal("Admin")),
    phoneNumber: v.string(),
    clerkId: v.string(),
  }).index("by_organizition", ["organizationId"]),

  // Organizations
  organization: defineTable({
    name: v.string(),
    address: v.string(),
    isLicenseVerficationRequired: v.boolean(),
    isVehicleRegistrationRequired: v.boolean(),
  }),
});
