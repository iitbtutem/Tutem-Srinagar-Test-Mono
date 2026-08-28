import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import {
  adminQuery,
  adminMutation,
  superAdminMutation,
} from "../helpers/sessionFunctions";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { validateAge, getAgeSettingsOrThrow } from "../helpers/validation";

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
              { expiresIn: 300 },
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
      }),
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
          { expiresIn: 300 },
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
      lastEditedByAdmin: rider.lastEditedByAdminId
        ? await ctx.db.get(rider.lastEditedByAdminId)
        : null,
    };
  },
});

export const updateRiderAdmin = adminMutation({
  args: {
    riderId: v.id("rider"),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
    phoneNumber: v.string(),
    isVerified: v.union(
      v.literal("Pending"),
      v.literal("Rejected"),
      v.literal("Verified"),
    ),
  },
  handler: async (ctx, args) => {
    const rider = await ctx.db.get(args.riderId);
    if (!rider) throw new ConvexError("Rider not found");

    // Validate rider age based on DB settings
    const ageSettings = await getAgeSettingsOrThrow(ctx);
    validateAge(args.dob, ageSettings.minRiderAge, ageSettings.maxRiderAge, "Rider");

    // Check phone number uniqueness if changed
    const currentUser = await ctx.db.get(rider.userId);
    if (currentUser && currentUser.phoneNumber !== args.phoneNumber) {
      const existingUser = await ctx.db
        .query("user")
        .withIndex("by_phoneNumber", (q) =>
          q.eq("phoneNumber", args.phoneNumber),
        )
        .first();
      if (existingUser && existingUser._id !== rider.userId) {
        throw new ConvexError("Phone number already in use by another user");
      }
    }

    const now = Date.now();
    await ctx.db.patch(rider.userId, {
      firstName: args.firstName,
      lastName: args.lastName,
      dob: args.dob,
      gender: args.gender,
      phoneNumber: args.phoneNumber,
      lastEditedByAdminId: ctx.user._id,
      lastEditedAt: now,
    });
    await ctx.db.patch(rider._id, {
      isVerified: args.isVerified,
      lastEditedByAdminId: ctx.user._id,
      lastEditedAt: now,
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
              { expiresIn: 300 },
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

        // Lookup the driver's current active ride (if any)
        const activeRide = await ctx.db
          .query("ride")
          .withIndex("by_driver", (q) => q.eq("driverId", driver._id))
          .filter((q) =>
            q.and(
              q.or(
                q.eq(q.field("status"), "Open"),
                q.eq(q.field("status"), "Active"),
                q.eq(q.field("status"), "Driver Arrived"),
              ),
              q.neq(q.field("requestStatus"), "Rejected"),
            ),
          )
          .first();

        let riderDetails = null;
        if (activeRide) {
          const rider = await ctx.db.get(activeRide.riderId);
          if (rider) {
            const riderUser = await ctx.db.get(rider.userId);
            if (riderUser) {
              riderDetails = {
                firstName: riderUser.firstName,
                lastName: riderUser.lastName,
                phoneNumber: riderUser.phoneNumber,
              };
            }
          }
        }

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
          activeRide: activeRide
            ? {
                _id: activeRide._id,
                status: activeRide.status,
                fare: activeRide.fare,
                pickup: activeRide.pickup,
                destination: activeRide.destination,
                updatedAt: activeRide.updatedAt,
                riderDetails,
              }
            : null,
        };
      }),
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
        if (
          !name.includes(s) &&
          !phone.includes(s) &&
          !reg.toLowerCase().includes(s)
        ) {
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
          { expiresIn: 300 },
        )
      : undefined;

    const licenseFrontImageUri = driver.licenseImageFrontKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: driver.licenseImageFrontKey,
          }),
          { expiresIn: 300 },
        )
      : undefined;

    const licenseBackImageUri = driver.licenseImageBackKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: driver.licenseImageBackKey,
          }),
          { expiresIn: 300 },
        )
      : undefined;

    const paymentQrCodeUri = driver.paymentQrCodeKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: driver.paymentQrCodeKey,
          }),
          { expiresIn: 300 },
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
        { expiresIn: 300 },
      );
    }

    if (vehicle?.insuranceImageKey) {
      vehicleInsuranceImageUri = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: process.env.MINIO_BUCKET,
          Key: vehicle.insuranceImageKey,
        }),
        { expiresIn: 300 },
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
      lastEditedByAdmin: driver.lastEditedByAdminId
        ? await ctx.db.get(driver.lastEditedByAdminId)
        : null,
    };
  },
});

export const updateDriverAdmin = adminMutation({
  args: {
    driverId: v.id("driver"),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
    phoneNumber: v.string(),
    licenseNumber: v.string(),
    isLicenseVerified: v.union(
      v.literal("Pending"),
      v.literal("Rejected"),
      v.literal("Verified"),
    ),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (!driver) throw new ConvexError("Driver not found");

    // Validate driver age based on DB settings
    const ageSettings = await getAgeSettingsOrThrow(ctx);
    validateAge(args.dob, ageSettings.minDriverAge, ageSettings.maxDriverAge, "Driver");

    // Check phone number uniqueness if changed
    const currentUser = await ctx.db.get(driver.userId);
    if (currentUser && currentUser.phoneNumber !== args.phoneNumber) {
      const existingUser = await ctx.db
        .query("user")
        .withIndex("by_phoneNumber", (q) =>
          q.eq("phoneNumber", args.phoneNumber),
        )
        .first();
      if (existingUser && existingUser._id !== driver.userId) {
        throw new ConvexError("Phone number already in use by another user");
      }
    }

    const now = Date.now();
    await ctx.db.patch(driver.userId, {
      firstName: args.firstName,
      lastName: args.lastName,
      dob: args.dob,
      gender: args.gender,
      phoneNumber: args.phoneNumber,
      lastEditedByAdminId: ctx.user._id,
      lastEditedAt: now,
    });
    await ctx.db.patch(driver._id, {
      licenseNumber: args.licenseNumber,
      isLicenseVerified: args.isLicenseVerified,
      lastEditedByAdminId: ctx.user._id,
      lastEditedAt: now,
    });
  },
});

export const updateDriverVehicleAdmin = adminMutation({
  args: {
    vehicleId: v.id("vehicle"),
    model: v.string(),
    type: v.union(
      v.literal("Hatchback"),
      v.literal("Sedan"),
      v.literal("Suv"),
      v.literal("Auto"),
      v.literal("Bike"),
    ),
    fuelType: v.union(
      v.literal("Petrol"),
      v.literal("Diesel"),
      v.literal("EV"),
    ),
    class: v.union(v.literal("Bike"), v.literal("Auto"), v.literal("Cab")),
    color: v.string(),
    registrationNumber: v.string(),
    seatingCapacity: v.number(),
  },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new ConvexError("Vehicle not found");

    // Check registration number uniqueness if changed
    if (vehicle.registrationNumber !== args.registrationNumber) {
      const existing = await ctx.db
        .query("vehicle")
        .withIndex("by_registrationNumber", (q) =>
          q.eq("registrationNumber", args.registrationNumber),
        )
        .first();
      if (existing && existing._id !== vehicle._id) {
        throw new ConvexError(
          "Registration number already in use by another vehicle",
        );
      }
    }

    await ctx.db.patch(vehicle._id, {
      model: args.model,
      type: args.type,
      fuelType: args.fuelType,
      class: args.class,
      color: args.color,
      registrationNumber: args.registrationNumber,
      seatingCapacity: args.seatingCapacity,
      lastEditedByAdminId: ctx.user._id,
      lastEditedAt: Date.now(),
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
          rider: rider ? { ...rider, userDetails: riderUser } : null,
          driver: driver ? { ...driver, userDetails: driverUser } : null,
          ratings,
        };
      }),
    );

    const activeRides = results.filter(Boolean);

    return activeRides.filter((ride) => {
      if (args.search) {
        const s = args.search.toLowerCase();
        const rName =
          `${ride.rider?.userDetails?.firstName || ""} ${ride.rider?.userDetails?.lastName || ""}`.toLowerCase();
        const dName =
          `${ride.driver?.userDetails?.firstName || ""} ${ride.driver?.userDetails?.lastName || ""}`.toLowerCase();
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
            q.eq("organizationId", organization._id),
          )
          .collect()
      : [];

    const riderProfileUri = riderUser?.profilePictureKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: riderUser.profilePictureKey,
          }),
          { expiresIn: 300 },
        )
      : undefined;

    const driverProfileUri = driverUser?.profilePictureKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: driverUser.profilePictureKey,
          }),
          { expiresIn: 300 },
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
    // Collect both Admin and Super Admin permission rows
    const allPerms = await ctx.db.query("userPermission").collect();
    const adminPerms = allPerms.filter(
      (p) => p.permission === "Admin" || p.permission === "Super Admin",
    );

    // Build a unique set of users (a user may have both Admin and Super Admin rows)
    const userMap = new Map<
      string,
      { adminPermId: string; isSuperAdmin: boolean }
    >();
    for (const perm of adminPerms) {
      const key = perm.userId as string;
      if (!userMap.has(key)) {
        userMap.set(key, {
          adminPermId: perm._id as string,
          isSuperAdmin: perm.permission === "Super Admin",
        });
      } else {
        // If we later see a Super Admin row for the same user, update the flag
        if (perm.permission === "Super Admin") {
          userMap.get(key)!.isSuperAdmin = true;
          userMap.get(key)!.adminPermId = perm._id as string;
        }
      }
    }

    const results = await Promise.all(
      Array.from(userMap.entries()).map(async ([userId, meta]) => {
        const user = await ctx.db.get(userId as any);
        if (!user) return null;

        const profilePictureKey = (user as any).profilePictureKey;
        const profilePictureUri = profilePictureKey
          ? await getSignedUrl(
              s3Client,
              new GetObjectCommand({
                Bucket: process.env.MINIO_BUCKET,
                Key: profilePictureKey,
              }),
              { expiresIn: 300 },
            )
          : undefined;

        return {
          ...user,
          profilePictureKey: profilePictureUri,
          permissionId: meta.adminPermId,
          isSuperAdmin: meta.isSuperAdmin,
        };
      }),
    );

    const activeAdmins = results.filter(Boolean) as any[];

    return activeAdmins.filter((admin) => {
      if (args.search) {
        const s = args.search.toLowerCase();
        const name =
          `${admin.firstName || ""} ${admin.lastName || ""}`.toLowerCase();
        const phone = admin.phoneNumber || "";
        if (!name.includes(s) && !phone.includes(s)) {
          return false;
        }
      }
      return true;
    });
  },
});

/** Returns the current logged-in admin's permissions list */
export const getCurrentAdminPermissions = adminQuery({
  args: {},
  handler: async (ctx) => {
    const perms = await ctx.db
      .query("userPermission")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
    return {
      permissions: perms.map((p) => p.permission),
      isSuperAdmin: perms.some((p) => p.permission === "Super Admin"),
    };
  },
});

export const createAdminUser = superAdminMutation({
  args: {
    phoneNumber: v.string(),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
    isSuperAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const targetPermission = args.isSuperAdmin ? "Super Admin" : "Admin";

    // Check if user with phone already exists
    const existingUser = await ctx.db
      .query("user")
      .withIndex("by_phoneNumber", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();

    if (existingUser) {
      // Check if already has this permission
      const existingPerm = await ctx.db
        .query("userPermission")
        .withIndex("by_user", (q) => q.eq("userId", existingUser._id))
        .filter((q) => q.eq(q.field("permission"), targetPermission))
        .first();

      if (existingPerm) {
        throw new ConvexError(
          `User already has ${targetPermission} permission`,
        );
      }

      // Ensure the user at minimum has Admin permission too
      const existingAdmin = await ctx.db
        .query("userPermission")
        .withIndex("by_user", (q) => q.eq("userId", existingUser._id))
        .filter((q) => q.eq(q.field("permission"), "Admin"))
        .first();

      if (!existingAdmin) {
        await ctx.db.insert("userPermission", {
          userId: existingUser._id,
          permission: "Admin",
        });
      }

      if (args.isSuperAdmin) {
        await ctx.db.insert("userPermission", {
          userId: existingUser._id,
          permission: "Super Admin",
        });
      }

      return existingUser._id;
    }

    const userId = await ctx.db.insert("user", {
      firstName: args.firstName,
      lastName: args.lastName,
      dob: args.dob,
      gender: args.gender,
      phoneNumber: args.phoneNumber,
    });

    // Always grant Admin
    await ctx.db.insert("userPermission", { userId, permission: "Admin" });

    // Optionally also grant Super Admin
    if (args.isSuperAdmin) {
      await ctx.db.insert("userPermission", {
        userId,
        permission: "Super Admin",
      });
    }

    return userId;
  },
});

/** Promoted or demotes an existing admin user (Super Admin only) */
export const updateAdminUser = superAdminMutation({
  args: {
    userId: v.id("user"),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
    phoneNumber: v.string(),
    isSuperAdmin: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("User not found");

    // Phone uniqueness check
    if (user.phoneNumber !== args.phoneNumber) {
      const existing = await ctx.db
        .query("user")
        .withIndex("by_phoneNumber", (q) =>
          q.eq("phoneNumber", args.phoneNumber),
        )
        .first();
      if (existing && existing._id !== args.userId) {
        throw new ConvexError("Phone number already in use by another user");
      }
    }

    // Update user details
    await ctx.db.patch(args.userId, {
      firstName: args.firstName,
      lastName: args.lastName,
      dob: args.dob,
      gender: args.gender,
      phoneNumber: args.phoneNumber,
      lastEditedByAdminId: ctx.user._id,
      lastEditedAt: Date.now(),
    });

    // Handle Super Admin promotion / demotion
    const superAdminPerm = await ctx.db
      .query("userPermission")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("permission"), "Super Admin"))
      .first();

    if (args.isSuperAdmin && !superAdminPerm) {
      // Promote: grant Super Admin
      await ctx.db.insert("userPermission", {
        userId: args.userId,
        permission: "Super Admin",
      });
    } else if (!args.isSuperAdmin && superAdminPerm) {
      // Demote: ensure at least one other Super Admin remains
      const superAdmins = await ctx.db
        .query("userPermission")
        .filter((q) => q.eq(q.field("permission"), "Super Admin"))
        .collect();
      if (superAdmins.length <= 1) {
        throw new ConvexError(
          "Cannot demote: at least one Super Admin must remain",
        );
      }
      await ctx.db.delete(superAdminPerm._id);
    }
  },
});

export const deleteAdminUser = superAdminMutation({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    if (args.userId === ctx.user._id) {
      throw new ConvexError("Cannot remove your own admin access");
    }

    // Guard: if the target is a Super Admin, ensure at least one other Super Admin remains
    const targetSuperAdminPerm = await ctx.db
      .query("userPermission")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("permission"), "Super Admin"))
      .first();

    if (targetSuperAdminPerm) {
      const allSuperAdmins = await ctx.db
        .query("userPermission")
        .filter((q) => q.eq(q.field("permission"), "Super Admin"))
        .collect();
      if (allSuperAdmins.length <= 1) {
        throw new ConvexError(
          "Cannot delete the last Super Admin. Promote another admin first.",
        );
      }
    }

    // Delete all Admin/Super Admin permissions for this user
    const allPerms = await ctx.db
      .query("userPermission")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const perm of allPerms) {
      if (perm.permission === "Admin" || perm.permission === "Super Admin") {
        await ctx.db.delete(perm._id);
      }
    }

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
          { expiresIn: 300 },
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
      v.literal("Verified"),
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
      v.literal("Verified"),
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
      v.literal("Verified"),
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
