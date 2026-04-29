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
  })
  .index("by_clerkId", ["clerkId"]),

  //riders
  rider: defineTable({
    isVerified: v.union(v.literal("Pending"), v.literal("Rejected"), v.literal("Verified")),
    userId: v.id("user"),
    expoPushToken: v.optional(v.string()),
    genderMatching: v.boolean(),
  })
  .index("by_user", ["userId"]),

  // Drivers
  driver: defineTable({
    licenseNumber: v.string(),
    licenseImageFrontKey: v.optional(v.string()),
    licenseImageBackKey: v.optional(v.string()),
    isLicenseVerified: v.union(v.literal("Pending"), v.literal("Rejected"), v.literal("Verified")),
    isOnline: v.boolean(),
    isAvailableForRide: v.boolean(),
    organizationId: v.id("organization"),
    userId: v.id("user"),
    expoPushToken: v.optional(v.string()),
    genderMatching: v.boolean(),
  })
  .index("by_user", ["userId"])
  .index("by_organizition", ["organizationId"]),

  // Organizations
  organization: defineTable({
    name: v.string(),
    address: v.string(),
    isLicenseVerficationRequired: v.boolean(),
    isVehicleRCVerificationRequired: v.boolean(),
    canDriverEditLicesnse: v.boolean(),
    canDriverEditVehicle: v.boolean(),
  }),

  //organization rates
  organizationsRate: defineTable({
    vehicleClass: v.union(...VEHICLE_CLASS.map((type) => v.literal(type))),
    baseDistance: v.number(),
    baseDistanceRate: v.number(),
    ratePerKm: v.number(),
    waitingPerMinute: v.number(),
    organizationId: v.id("organization"),
  }).index("by_organization", ["organizationId"]),

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

  ride: defineTable({
    riderId: v.id("rider"),
    driverId: v.id("driver"),
    fare: v.number(),
    status: v.union(v.literal("Open"), v.literal("Active"), v.literal("Completed"), v.literal("Canceled")),
    requestStatus: v.union(v.literal("Pending"), v.literal("Accepted"), v.literal("Rejected")),
    pickup: v.object({
      address: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
    destination: v.object({
      address: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
    distance: v.number(),
    expectedDuration: v.optional(v.string()),
    updatedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
  .index("by_rider", ["riderId"])
  .index("by_driver", ["driverId"]),

  ratings: defineTable({
    rideId: v.id("ride"),
    riderId: v.id("rider"),
    driverId: v.id("driver"),
    raterType: v.union(v.literal("Rider"), v.literal("Driver")),
    score: v.number(),        // 1–5
    comment: v.optional(v.string()),
  })
  .index("by_ride", ["rideId"])
  .index("by_rider", ["riderId"])
  .index("by_driver", ["driverId"]),

});
