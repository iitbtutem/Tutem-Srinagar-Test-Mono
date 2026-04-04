import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { FUEL_TYPE, PERMISSIONS, VEHICLE_CLASS, VEHICLE_TYPE } from "./CONSTANTS";

export default defineSchema({
  // Users
  user: defineTable({
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    profilePictureKey: v.optional(v.string()),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
    phoneNumber: v.string(),
    clerkId: v.string(),
  }),

  //riders
  rider: defineTable({
    isVerified: v.union(v.literal("Pending"), v.literal("Rejected"), v.literal("Verified")),
    userId: v.id("user"),
  }),

  // Drivers
  driver: defineTable({
    licenseNumber: v.string(),
    licenseImageFrontKey: v.optional(v.string()),
    licenseImageBackKey: v.optional(v.string()),
    isLicenseVerified: v.union(v.literal("Pending"), v.literal("Rejected"), v.literal("Verified")),
    organizationId: v.id("organization"),
    userId: v.id("user"),
  }).index("by_organizition", ["organizationId"]),

  // Organizations
  organization: defineTable({
    name: v.string(),
    address: v.string(),
    isLicenseVerficationRequired: v.boolean(),
    isVehicleRCVerificationRequired: v.boolean(),
    canDriverEditLicesnse: v.boolean(),
    canDriverEditVehicle: v.boolean(),
  }),

  //vehciles
  vehicle: defineTable({
    isVerified: v.union(v.literal("Pending"), v.literal("Rejected"), v.literal("Verified")),
    registrationNumber: v.string(),
    rcImageKey: v.optional(v.string()),
    model: v.string(),
    type: v.union(...VEHICLE_TYPE.map((type) => v.literal(type))),
    fuelType: v.union(...FUEL_TYPE.map((type) => v.literal(type))),
    class: v.union(...VEHICLE_CLASS.map((type) => v.literal(type))),
    color: v.string(),
    seatingCapacity: v.number(),
    ownerId: v.id("driver"),
  }).index("by_owner", ["ownerId"]),

  // permissions
  userPermission: defineTable({
    permission: v.union(...PERMISSIONS.map(p => v.literal(p))),
    userId: v.id("user")
  }).index("by_user", ["userId"]),
});
