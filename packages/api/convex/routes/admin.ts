import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import {
  adminQuery,
  adminMutation,
} from "../helpers/sessionFunctions";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ─── Riders ────────────────────────────────────────────────────────────────

export const getAllRiders = adminQuery({
  args: {
    search: v.optional(v.string()),
    gender: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const riders = await ctx.db.query("rider").collect();

    const results = await Promise.all(
      riders.map(async (rider) => {
        const user = await ctx.db.get(rider.userId);
        if (!user) return null;

        const profilePictureUri = user.profilePictureKey
          ? await getSignedUrl(
              s3Client,
              new GetObjectCommand({
                Bucket: process.env.MINIO_BUCKET,
                Key: user.profilePictureKey,
              }),
              { expiresIn: 300 }
            )
          : undefined;

        const ratings = await ctx.db
          .query("ratings")
          .withIndex("by_rider", (q) => q.eq("riderId", rider._id))
          .filter((q) => q.eq(q.field("raterType"), "Driver"))
          .collect();

        const averageRating =
          ratings.length === 0
            ? null
            : ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;

        return {
          ...rider,
          userDetails: {
            ...user,
            profilePictureKey: profilePictureUri,
          },
          averageRating,
          totalRatings: ratings.length,
        };
      })
    );

    const activeRiders = results.filter(Boolean) as any[];

    return activeRiders.filter((rider) => {
      if (args.search) {
        const s = args.search.toLowerCase();
        const firstName = rider.userDetails?.firstName || "";
        const lastName = rider.userDetails?.lastName || "";
        const name = `${firstName} ${lastName}`.toLowerCase();
        const phone = rider.userDetails?.phoneNumber || "";
        if (!name.includes(s) && !phone.includes(s)) {
          return false;
        }
      }
      if (args.gender && args.gender.length > 0) {
        if (!args.gender.includes(rider.userDetails?.gender)) return false;
      }
      return true;
    });
  },
});

export const getRiderById = adminQuery({
  args: { id: v.id("rider") },
  handler: async (ctx, args) => {
    const rider = await ctx.db.get(args.id);
    if (!rider) throw new ConvexError("Rider not found");

    const user = await ctx.db.get(rider.userId);
    if (!user) throw new ConvexError("User not found");

    const profilePictureUri = user.profilePictureKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: user.profilePictureKey,
          }),
          { expiresIn: 300 }
        )
      : undefined;

    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_rider", (q) => q.eq("riderId", rider._id))
      .filter((q) => q.eq(q.field("raterType"), "Driver"))
      .collect();

    const averageRating =
      ratings.length === 0
        ? null
        : ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;

    // Ride history
    const rides = await ctx.db
      .query("ride")
      .withIndex("by_rider", (q) => q.eq("riderId", rider._id))
      .order("desc")
      .take(50);

    return {
      ...rider,
      userDetails: {
        ...user,
        profilePictureKey: profilePictureUri,
      },
      averageRating,
      totalRatings: ratings.length,
      ratings,
      rideHistory: rides,
    };
  },
});

export const updateRiderAdmin = adminMutation({
  args: {
    riderId: v.id("rider"),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    isVerified: v.union(
      v.literal("Pending"),
      v.literal("Rejected"),
      v.literal("Verified")
    ),
  },
  handler: async (ctx, args) => {
    const rider = await ctx.db.get(args.riderId);
    if (!rider) throw new ConvexError("Rider not found");

    await ctx.db.patch(rider.userId, {
      firstName: args.firstName,
      lastName: args.lastName,
    });
    await ctx.db.patch(rider._id, {
      isVerified: args.isVerified,
    });
  },
});

// ─── Drivers ───────────────────────────────────────────────────────────────

export const getAllDrivers = adminQuery({
  args: {
    search: v.optional(v.string()),
    online: v.optional(v.array(v.string())),
    license: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const drivers = await ctx.db.query("driver").collect();

    const results = await Promise.all(
      drivers.map(async (driver) => {
        const user = await ctx.db.get(driver.userId);
        if (!user) return null;

        const profilePictureUri = user.profilePictureKey
          ? await getSignedUrl(
              s3Client,
              new GetObjectCommand({
                Bucket: process.env.MINIO_BUCKET,
                Key: user.profilePictureKey,
              }),
              { expiresIn: 300 }
            )
          : undefined;

        const vehicle = await ctx.db
          .query("vehicle")
          .withIndex("by_owner", (q) => q.eq("ownerId", driver._id))
          .first();

        const organization = await ctx.db.get(driver.organizationId);

        const ratings = await ctx.db
          .query("ratings")
          .withIndex("by_driver", (q) => q.eq("driverId", driver._id))
          .filter((q) => q.eq(q.field("raterType"), "Rider"))
          .collect();

        const averageRating =
          ratings.length === 0
            ? null
            : ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;

        return {
          ...driver,
          userDetails: {
            ...user,
            profilePictureKey: profilePictureUri,
          },
          vehicle,
          organization,
          averageRating,
          totalRatings: ratings.length,
        };
      })
    );

    const activeDrivers = results.filter(Boolean) as any[];

    return activeDrivers.filter((driver) => {
      if (args.search) {
        const s = args.search.toLowerCase();
        const firstName = driver.userDetails?.firstName || "";
        const lastName = driver.userDetails?.lastName || "";
        const name = `${firstName} ${lastName}`.toLowerCase();
        const phone = driver.userDetails?.phoneNumber || "";
        const reg = driver.vehicle?.registrationNumber || "";
        if (!name.includes(s) && !phone.includes(s) && !reg.toLowerCase().includes(s)) {
          return false;
        }
      }
      if (args.online && args.online.length > 0) {
        const hasOnline = args.online.includes("Online");
        const hasOffline = args.online.includes("Offline");
        if (hasOnline && !hasOffline && !driver.isOnline) return false;
        if (hasOffline && !hasOnline && driver.isOnline) return false;
      }
      if (args.license && args.license.length > 0) {
        if (!args.license.includes(driver.isLicenseVerified)) return false;
      }
      return true;
    });
  },
});

export const getDriverById = adminQuery({
  args: { id: v.id("driver") },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.id);
    if (!driver) throw new ConvexError("Driver not found");

    const user = await ctx.db.get(driver.userId);
    if (!user) throw new ConvexError("User not found");

    const profilePictureUri = user.profilePictureKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: user.profilePictureKey,
          }),
          { expiresIn: 300 }
        )
      : undefined;

    const licenseFrontImageUri = driver.licenseImageFrontKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: driver.licenseImageFrontKey,
          }),
          { expiresIn: 300 }
        )
      : undefined;

    const licenseBackImageUri = driver.licenseImageBackKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: driver.licenseImageBackKey,
          }),
          { expiresIn: 300 }
        )
      : undefined;

    const paymentQrCodeUri = driver.paymentQrCodeKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: driver.paymentQrCodeKey,
          }),
          { expiresIn: 300 }
        )
      : undefined;

    const vehicle = await ctx.db
      .query("vehicle")
      .withIndex("by_owner", (q) => q.eq("ownerId", driver._id))
      .first();

    let vehicleRcImageUri: string | undefined;
    let vehicleInsuranceImageUri: string | undefined;

    if (vehicle?.rcImageKey) {
      vehicleRcImageUri = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: process.env.MINIO_BUCKET,
          Key: vehicle.rcImageKey,
        }),
        { expiresIn: 300 }
      );
    }

    if (vehicle?.insuranceImageKey) {
      vehicleInsuranceImageUri = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: process.env.MINIO_BUCKET,
          Key: vehicle.insuranceImageKey,
        }),
        { expiresIn: 300 }
      );
    }

    const organization = await ctx.db.get(driver.organizationId);

    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_driver", (q) => q.eq("driverId", driver._id))
      .filter((q) => q.eq(q.field("raterType"), "Rider"))
      .collect();

    const averageRating =
      ratings.length === 0
        ? null
        : ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;

    const rides = await ctx.db
      .query("ride")
      .withIndex("by_driver", (q) => q.eq("driverId", driver._id))
      .order("desc")
      .take(50);

    return {
      ...driver,
      userDetails: {
        ...user,
        profilePictureKey: profilePictureUri,
      },
      licenseImageFrontKey: licenseFrontImageUri,
      licenseImageBackKey: licenseBackImageUri,
      paymentQrCodeKey: paymentQrCodeUri,
      vehicle: vehicle
        ? {
            ...vehicle,
            rcImageKey: vehicleRcImageUri,
            insuranceImageKey: vehicleInsuranceImageUri,
          }
        : null,
      organization,
      averageRating,
      totalRatings: ratings.length,
      ratings,
      rideHistory: rides,
    };
  },
});

export const updateDriverAdmin = adminMutation({
  args: {
    driverId: v.id("driver"),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    isLicenseVerified: v.union(
      v.literal("Pending"),
      v.literal("Rejected"),
      v.literal("Verified")
    ),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (!driver) throw new ConvexError("Driver not found");

    await ctx.db.patch(driver.userId, {
      firstName: args.firstName,
      lastName: args.lastName,
    });
    await ctx.db.patch(driver._id, {
      isLicenseVerified: args.isLicenseVerified,
    });
  },
});

// ─── Rides ─────────────────────────────────────────────────────────────────

export const getAllRidesAdmin = adminQuery({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.array(v.string())),
    dateFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const rides = await ctx.db.query("ride").order("desc").take(1000);

    const results = await Promise.all(
      rides.map(async (ride) => {
        const rider = await ctx.db.get(ride.riderId);
        const driver = await ctx.db.get(ride.driverId);

        const riderUser = rider ? await ctx.db.get(rider.userId) : null;
        const driverUser = driver ? await ctx.db.get(driver.userId) : null;

        const ratings = await ctx.db
          .query("ratings")
          .withIndex("by_ride", (q) => q.eq("rideId", ride._id))
          .collect();

        return {
          ...ride,
          rider: rider
            ? { ...rider, userDetails: riderUser }
            : null,
          driver: driver
            ? { ...driver, userDetails: driverUser }
            : null,
          ratings,
        };
      })
    );

    const activeRides = results.filter(Boolean);

    return activeRides.filter((ride) => {
      if (args.search) {
        const s = args.search.toLowerCase();
        const rName = `${ride.rider?.userDetails?.firstName || ""} ${ride.rider?.userDetails?.lastName || ""}`.toLowerCase();
        const dName = `${ride.driver?.userDetails?.firstName || ""} ${ride.driver?.userDetails?.lastName || ""}`.toLowerCase();
        const rideId = String(ride._id).toLowerCase();
        if (!rName.includes(s) && !dName.includes(s) && !rideId.includes(s)) {
          return false;
        }
      }
      if (args.status && args.status.length > 0) {
        if (!args.status.includes(ride.status)) return false;
      }
      if (args.dateFilter) {
        const now = Date.now();
        if (args.dateFilter === "Today") {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          if (ride.requestedAt < startOfToday.getTime()) return false;
        } else if (args.dateFilter === "Last 7 days") {
          const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
          if (ride.requestedAt < sevenDaysAgo) return false;
        } else if (args.dateFilter === "Last 30 days") {
          const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
          if (ride.requestedAt < thirtyDaysAgo) return false;
        }
      }
      return true;
    });
  },
});

export const getRideByIdAdmin = adminQuery({
  args: { id: v.id("ride") },
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.id);
    if (!ride) throw new ConvexError("Ride not found");

    const rider = await ctx.db.get(ride.riderId);
    const driver = await ctx.db.get(ride.driverId);

    const riderUser = rider ? await ctx.db.get(rider.userId) : null;
    const driverUser = driver ? await ctx.db.get(driver.userId) : null;

    const vehicle = driver
      ? await ctx.db
          .query("vehicle")
          .withIndex("by_owner", (q) => q.eq("ownerId", driver._id))
          .first()
      : null;

    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_ride", (q) => q.eq("rideId", ride._id))
      .collect();

    const reasons = await ctx.db
      .query("rideReasons")
      .withIndex("by_ride", (q) => q.eq("rideId", ride._id))
      .collect();

    const organization = driver
      ? await ctx.db.get(driver.organizationId)
      : null;

    const orgRates = organization
      ? await ctx.db
          .query("organizationsRate")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organization._id)
          )
          .collect()
      : [];

    const riderProfileUri =
      riderUser?.profilePictureKey
        ? await getSignedUrl(
            s3Client,
            new GetObjectCommand({
              Bucket: process.env.MINIO_BUCKET,
              Key: riderUser.profilePictureKey,
            }),
            { expiresIn: 300 }
          )
        : undefined;

    const driverProfileUri =
      driverUser?.profilePictureKey
        ? await getSignedUrl(
            s3Client,
            new GetObjectCommand({
              Bucket: process.env.MINIO_BUCKET,
              Key: driverUser.profilePictureKey,
            }),
            { expiresIn: 300 }
          )
        : undefined;

    return {
      ...ride,
      rider: rider
        ? {
            ...rider,
            userDetails: riderUser
              ? { ...riderUser, profilePictureKey: riderProfileUri }
              : null,
          }
        : null,
      driver: driver
        ? {
            ...driver,
            userDetails: driverUser
              ? { ...driverUser, profilePictureKey: driverProfileUri }
              : null,
          }
        : null,
      vehicle,
      ratings,
      reasons,
      organization,
      orgRates,
    };
  },
});

// ─── Admin Users ────────────────────────────────────────────────────────────

export const getAllAdminUsers = adminQuery({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const permissions = await ctx.db
      .query("userPermission")
      .filter((q) => q.eq(q.field("permission"), "Admin"))
      .collect();

    const results = await Promise.all(
      permissions.map(async (perm) => {
        const user = await ctx.db.get(perm.userId);
        if (!user) return null;

        const profilePictureUri = user.profilePictureKey
          ? await getSignedUrl(
              s3Client,
              new GetObjectCommand({
                Bucket: process.env.MINIO_BUCKET,
                Key: user.profilePictureKey,
              }),
              { expiresIn: 300 }
            )
          : undefined;

        const allPerms = await ctx.db
          .query("userPermission")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();

        return {
          ...user,
          profilePictureKey: profilePictureUri,
          permissionId: perm._id,
          permissions: allPerms.map((p) => p.permission),
        };
      })
    );

    const activeAdmins = results.filter(Boolean) as any[];

    return activeAdmins.filter((admin) => {
      if (args.search) {
        const s = args.search.toLowerCase();
        const name = `${admin.firstName || ""} ${admin.lastName || ""}`.toLowerCase();
        const email = (admin.email || "").toLowerCase();
        const phone = admin.phoneNumber || "";
        if (!name.includes(s) && !email.includes(s) && !phone.includes(s)) {
          return false;
        }
      }
      return true;
    });
  },
});

export const createAdminUser = adminMutation({
  args: {
    phoneNumber: v.string(),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    gender: v.union(
      v.literal("Male"),
      v.literal("Female"),
      v.literal("Other")
    ),
  },
  handler: async (ctx, args) => {
    // Check if user with phone already exists
    const existingUser = await ctx.db
      .query("user")
      .withIndex("by_phoneNumber", (q) =>
        q.eq("phoneNumber", args.phoneNumber)
      )
      .first();

    if (existingUser) {
      // Check if already has admin permission
      const existingAdmin = await ctx.db
        .query("userPermission")
        .withIndex("by_user", (q) => q.eq("userId", existingUser._id))
        .filter((q) => q.eq(q.field("permission"), "Admin"))
        .first();

      if (existingAdmin) {
        throw new ConvexError("User already has Admin permission");
      }

      await ctx.db.insert("userPermission", {
        userId: existingUser._id,
        permission: "Admin",
      });

      return existingUser._id;
    }

    const userId = await ctx.db.insert("user", {
      firstName: args.firstName,
      lastName: args.lastName,
      dob: args.dob,
      gender: args.gender,
      phoneNumber: args.phoneNumber,
    });

    await ctx.db.insert("userPermission", {
      userId,
      permission: "Admin",
    });

    return userId;
  },
});

export const deleteAdminUser = adminMutation({
  args: { permissionId: v.id("userPermission") },
  handler: async (ctx, args) => {
    // Make sure we're not deleting the currently logged-in admin
    const perm = await ctx.db.get(args.permissionId);
    if (!perm) throw new ConvexError("Permission not found");

    if (perm.userId === ctx.user._id) {
      throw new ConvexError("Cannot remove your own admin permission");
    }

    await ctx.db.delete(args.permissionId);
    return { success: true };
  },
});

// ─── Settings ──────────────────────────────────────────────────────────────

export const updateRideSettings = adminMutation({
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

// ─── Admin Profile ──────────────────────────────────────────────────────────

export const getAdminProfile = adminQuery({
  args: {},
  handler: async (ctx) => {
    const profilePictureUri = ctx.user.profilePictureKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: ctx.user.profilePictureKey,
          }),
          { expiresIn: 300 }
        )
      : undefined;

    return {
      ...ctx.user,
      profilePictureKey: profilePictureUri,
    };
  },
});

export const updateAdminProfile = adminMutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
    });
  },
});

export const updateAdminProfilePicture = adminMutation({
  args: {
    profilePictureKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.user._id, {
      profilePictureKey: args.profilePictureKey,
    });
  },
});

export const toggleRiderBlacklist = adminMutation({
  args: {
    riderId: v.id("rider"),
    isBlacklisted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const rider = await ctx.db.get(args.riderId);
    if (!rider) throw new ConvexError("Rider not found");
    await ctx.db.patch(rider._id, {
      isBlacklisted: args.isBlacklisted,
    });
  },
});

export const toggleDriverBlacklist = adminMutation({
  args: {
    driverId: v.id("driver"),
    isBlacklisted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (!driver) throw new ConvexError("Driver not found");
    await ctx.db.patch(driver._id, {
      isBlacklisted: args.isBlacklisted,
    });
    if (args.isBlacklisted) {
      await ctx.db.patch(driver._id, {
        isOnline: false,
        isAvailableForRide: false,
      });
    }
  },
});

export const verifyRiderAdmin = adminMutation({
  args: {
    riderId: v.id("rider"),
    isVerified: v.union(
      v.literal("Pending"),
      v.literal("Rejected"),
      v.literal("Verified")
    ),
  },
  handler: async (ctx, args) => {
    const rider = await ctx.db.get(args.riderId);
    if (!rider) throw new ConvexError("Rider not found");
    await ctx.db.patch(rider._id, {
      isVerified: args.isVerified,
    });
  },
});

export const verifyDriverLicenseAdmin = adminMutation({
  args: {
    driverId: v.id("driver"),
    isLicenseVerified: v.union(
      v.literal("Pending"),
      v.literal("Rejected"),
      v.literal("Verified")
    ),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (!driver) throw new ConvexError("Driver not found");
    await ctx.db.patch(driver._id, {
      isLicenseVerified: args.isLicenseVerified,
    });
  },
});

export const verifyVehicleAdmin = adminMutation({
  args: {
    vehicleId: v.id("vehicle"),
    isVerified: v.union(
      v.literal("Pending"),
      v.literal("Rejected"),
      v.literal("Verified")
    ),
  },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new ConvexError("Vehicle not found");
    await ctx.db.patch(vehicle._id, {
      isVerified: args.isVerified,
    });
  },
});

