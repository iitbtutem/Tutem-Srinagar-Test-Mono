import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  user: defineTable({
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    licenseNumber: v.string(),
    organizationId: v.string(),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
  }),
  organization: defineTable({
    name: v.string(),
    address: v.string(),
    isLicenseVerficationRequired: v.boolean(),
    isVehicleRegistrationRequired: v.boolean(),
  }),
});
