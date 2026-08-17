import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  FUEL_TYPE,
  PERMISSIONS,
  VEHICLE_CLASS,
  VEHICLE_TYPE,
} from "./CONSTANTS";

export default defineSchema({
  // Users
  user: defineTable({
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    profilePictureKey: v.optional(v.string()),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
    phoneNumber: v.string(),
    lastEditedByAdminId: v.optional(v.id("user")),
    lastEditedAt: v.optional(v.number()),
  }).index("by_phoneNumber", ["phoneNumber"]),

  //riders
  rider: defineTable({
    isVerified: v.union(
      v.literal("Pending"),
      v.literal("Rejected"),
      v.literal("Verified"),
    ),
    userId: v.id("user"),
    expoPushToken: v.optional(v.string()),
    genderMatching: v.boolean(),
    isBlacklisted: v.optional(v.boolean()),
    lastEditedByAdminId: v.optional(v.id("user")),
    lastEditedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // Drivers
  driver: defineTable({
    licenseNumber: v.string(),
    licenseImageFrontKey: v.optional(v.string()),
    licenseImageBackKey: v.optional(v.string()),
    paymentQrCodeKey: v.optional(v.string()),
    isLicenseVerified: v.union(
      v.literal("Pending"),
      v.literal("Rejected"),
      v.literal("Verified"),
    ),
    isOnline: v.boolean(),
    isAvailableForRide: v.boolean(),
    organizationId: v.id("organization"),
    userId: v.id("user"),
    expoPushToken: v.optional(v.string()),
    genderMatching: v.boolean(),
    isBlacklisted: v.optional(v.boolean()),
    lastEditedByAdminId: v.optional(v.id("user")),
    lastEditedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  // Organizations
  organization: defineTable({
    name: v.string(),
    address: v.string(),
    isLicenseVerficationRequired: v.boolean(),
    isVehicleRCVerificationRequired: v.boolean(),
    isVehicleInsuranceImageRequired: v.boolean(),
    canDriverEditLicense: v.boolean(),
    canDriverEditVehicle: v.boolean(),
    polygon: v.optional(
      v.array(
        v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),
      ),
    ),
    boundingBox: v.optional(
      v.object({
        north: v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),

        south: v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),

        east: v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),

        west: v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),
      }),
    ),
    isSuspended: v.optional(v.boolean()),
    suspendedReason: v.optional(v.string()),
    suspendedAt: v.optional(v.number()),
    suspendedByAdminId: v.optional(v.id("user")),
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
    isVerified: v.union(
      v.literal("Pending"),
      v.literal("Rejected"),
      v.literal("Verified"),
    ),
    registrationNumber: v.string(),
    rcImageKey: v.optional(v.string()),
    insuranceImageKey: v.optional(v.string()),
    model: v.string(),
    type: v.union(...VEHICLE_TYPE.map((type) => v.literal(type))),
    fuelType: v.union(...FUEL_TYPE.map((type) => v.literal(type))),
    class: v.union(...VEHICLE_CLASS.map((type) => v.literal(type))),
    color: v.string(),
    seatingCapacity: v.number(),
    ownerId: v.id("driver"),
    lastEditedByAdminId: v.optional(v.id("user")),
    lastEditedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_registrationNumber", ["registrationNumber"]),

  // permissions
  userPermission: defineTable({
    permission: v.union(...PERMISSIONS.map((p) => v.literal(p))),
    userId: v.id("user"),
  }).index("by_user", ["userId"]),

  ride: defineTable({
    riderId: v.id("rider"),
    driverId: v.id("driver"),
    fare: v.number(),
    hasReachedDestination: v.boolean(),
    status: v.union(
      v.literal("Open"),
      v.literal("Active"),
      v.literal("Driver Arrived"),
      v.literal("Abort"),
      v.literal("Completed"),
      v.literal("Canceled"),
    ),
    requestStatus: v.union(
      v.literal("Pending"),
      v.literal("Accepted"),
      v.literal("Rejected"),
      v.literal("No Response"),
    ),
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
    dropOff: v.optional(
      v.object({
        address: v.string(),
        latitude: v.number(),
        longitude: v.number(),
      }),
    ),
    distance: v.number(),
    expectedDuration: v.optional(v.string()),
    otp: v.optional(v.number()),
    updatedAt: v.number(),
    requestedAt: v.number(),
    acceptedAt: v.optional(v.number()),
    arrivedAt: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_rider", ["riderId"])
    .index("by_driver", ["driverId"]),

  rideReasons: defineTable({
    rideId: v.id("ride"),
    driverId: v.optional(v.id("driver")),
    reason: v.string(),
  }).index("by_ride", ["rideId"]),

  ratings: defineTable({
    rideId: v.id("ride"),
    riderId: v.id("rider"),
    driverId: v.id("driver"),
    raterType: v.union(v.literal("Rider"), v.literal("Driver")),
    score: v.number(), // 1–5
    comment: v.optional(v.string()),
  })
    .index("by_ride", ["rideId"])
    .index("by_rider", ["riderId"])
    .index("by_driver", ["driverId"]),

  rideSettings: defineTable({
    nearbyRadius: v.number(),
    arrivedDistance: v.number(),
    driverResponseTime: v.number(),
    maxDriverRideRequests: v.optional(v.number()),
    cancellationPenalty: v.optional(v.number()),
  }),

  otpSession: defineTable({
    phoneNumber: v.string(),
    hashedOtp: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
  }).index("by_phone", ["phoneNumber"]),

  session: defineTable({
    sessionToken: v.string(),
    userId: v.id("user"),
    phoneNumber: v.string(),
    expiresAt: v.number(),
  })
    .index("by_sessionToken", ["sessionToken"])
    .index("by_phone", ["phoneNumber"])
    .index("by_userId", ["userId"]),
});
