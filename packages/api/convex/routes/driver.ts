import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "../_generated/server";
import { driverQuery, driverMutation } from "../helpers/sessionFunctions";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { internal } from "../_generated/api";

export const login = mutation({
  args: {
    driverId: v.id("driver"),
    expoPushToken: v.string(),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (driver === null) return;
    if (driver.isBlacklisted === true) {
      throw new ConvexError("Driver is blacklisted/blocked");
    }

    const activeRide = await ctx.db
      .query("ride")
      .withIndex("by_driver", (q) => q.eq("driverId", driver._id))
      .first();

    await ctx.db.patch(driver._id, {
      expoPushToken: args.expoPushToken,
      isAvailableForRide: activeRide ? false : true,
    });
  },
});

export const registerExpoPushToken = driverMutation({
  args: {
    driverId: v.id("driver"),
    expoPushToken: v.string(),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (driver === null) return;
    if (driver.expoPushToken === args.expoPushToken) return;

    await ctx.db.patch(driver._id, {
      expoPushToken: args.expoPushToken,
    });
  },
});

export const logout = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.runQuery(internal.routes.auth.getSessionByToken, {
      sessionToken: args.sessionToken,
    });
    if (session === null) return;

    const driver = await ctx.db
      .query("driver")
      .withIndex("by_user", (q) => q.eq("userId", session.userId))
      .first();
    if (driver === null) return;

    await ctx.db.patch(driver._id, {
      isOnline: false,
      isAvailableForRide: false,
      expoPushToken: undefined,
    });

    if (session) await ctx.db.delete(session._id);
  },
});

export const addDriver = mutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    licenseNumber: v.string(),
    licenseImageFrontKey: v.optional(v.string()),
    licenseImageBackKey: v.optional(v.string()),
    organizationId: v.id("organization"),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
    phoneNumber: v.string(),
    expoPushToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let existingUser = await ctx.db
      .query("user")
      .withIndex("by_phoneNumber", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();

    if (existingUser) {
      const existingDriver = await ctx.db
        .query("driver")
        .withIndex("by_user", (q) => q.eq("userId", existingUser._id))
        .first();

      if (existingDriver) {
        throw new ConvexError(
          "Driver already Registered with this phone number",
        );
      }
    }

    const organization = await ctx.db.get(args.organizationId);

    if (organization === null) throw new ConvexError("Organization not found");

    let userId = existingUser?._id;
    if (existingUser === null) {
      userId = await ctx.db.insert("user", {
        firstName: args.firstName,
        lastName: args.lastName,
        dob: args.dob,
        gender: args.gender,
        phoneNumber: args.phoneNumber,
      });
    }

    if (userId === undefined) throw new ConvexError("Failed to create user");

    await ctx.db.insert("userPermission", {
      userId: userId,
      permission: "Driver",
    });
    await ctx.db.insert("driver", {
      userId: userId,
      organizationId: args.organizationId,
      licenseNumber: args.licenseNumber,
      isAvailableForRide: true,
      isOnline: true,
      isLicenseVerified: organization.isLicenseVerficationRequired
        ? "Pending"
        : "Verified",
      genderMatching: false,
      isBlacklisted: false,
      ...(args.licenseImageBackKey !== undefined
        ? { licenseImageBackKey: args.licenseImageBackKey }
        : {}),
      ...(args.licenseImageFrontKey !== undefined
        ? { licenseImageFrontKey: args.licenseImageFrontKey }
        : {}),
      ...(args.expoPushToken !== undefined
        ? { expoPushToken: args.expoPushToken }
        : {}),
    });

    return userId;
  },
});

export const registerAsDriver = driverMutation({
  args: {
    licenseNumber: v.string(),
    licenseImageFrontKey: v.optional(v.string()),
    licenseImageBackKey: v.optional(v.string()),
    organizationId: v.id("organization"),
    expoPushToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingDriver = await ctx.db
      .query("driver")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .first();
    if (existingDriver !== null)
      throw new ConvexError("Driver profile already exists");

    const organization = await ctx.db.get(args.organizationId);

    if (organization === null) throw new ConvexError("Organization not found");

    await ctx.db.insert("driver", {
      userId: ctx.user._id,
      licenseNumber: args.licenseNumber,
      isAvailableForRide: true,
      isOnline: true,
      isLicenseVerified: organization.isLicenseVerficationRequired
        ? "Pending"
        : "Verified",
      organizationId: args.organizationId,
      genderMatching: false,
      isBlacklisted: false,
      ...(args.licenseImageFrontKey !== undefined
        ? { licenseImageFrontKey: args.licenseImageFrontKey }
        : {}),
      ...(args.licenseImageBackKey !== undefined
        ? { licenseImageBackKey: args.licenseImageBackKey }
        : {}),
      ...(args.expoPushToken !== undefined
        ? { expoPushToken: args.expoPushToken }
        : {}),
    });
    await ctx.db.insert("userPermission", {
      userId: ctx.user._id,
      permission: "Driver",
    });
  },
});

export const getUser = driverQuery({
  args: {},
  handler: async (ctx) => {
    const driver = await ctx.db
      .query("driver")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .first();

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

    if (driver === null) {
      return {
        ...ctx.user,
        profilePictureKey: profilePictureUri,
        driverDetails: null,
      };
    }

    let licenseFrontImageUri;
    let licenseBackImageUri;

    licenseFrontImageUri = driver?.licenseImageFrontKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: driver.licenseImageFrontKey,
          }),
          { expiresIn: 300 },
        )
      : undefined;

    licenseBackImageUri = driver?.licenseImageBackKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: driver.licenseImageBackKey,
          }),
          { expiresIn: 300 },
        )
      : undefined;

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
      ...ctx.user,
      profilePictureKey: profilePictureUri,
      driverDetails: driver
        ? {
            ...driver,
            organization: organization,
            licenseImageFrontKey: licenseFrontImageUri,
            licenseImageBackKey: licenseBackImageUri,
            averageRating,
            totalRatings: ratings.length,
          }
        : null,
    };
  },
});

export const getDriver = driverQuery({
  args: {
    id: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.id);
    if (driver === null) throw new ConvexError("Driver not found");

    const user = await ctx.db.get(driver.userId);

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

    const profilePictureUri =
      user !== null && user.profilePictureKey
        ? await getSignedUrl(
            s3Client,
            new GetObjectCommand({
              Bucket: process.env.MINIO_BUCKET,
              Key: user.profilePictureKey,
            }),
            { expiresIn: 300 },
          )
        : undefined;

    return {
      ...driver,
      userDetails: user
        ? {
            ...user,
            profilePictureKey: profilePictureUri,
          }
        : null,
      licenseImageFrontKey: licenseFrontImageUri,
      licenseImageBackKey: licenseBackImageUri,
      paymentQrCodeKey: paymentQrCodeUri,
    };
  },
});

export const getDriverPushTokenInternal = internalQuery({
  args: {
    id: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.id);
    if (driver === null) throw new ConvexError("Invalid Driver");
    return driver.expoPushToken;
  },
});

export const getDriverInternal = internalQuery({
  args: {
    id: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.id);
    if (driver === null) throw new ConvexError("Invalid Driver");

    const vehicle = await ctx.db
      .query("vehicle")
      .withIndex("by_owner", (q) => q.eq("ownerId", driver._id))
      .first();

    return { ...driver, vehicle };
  },
});

export const updateDriver = driverMutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    licenseNumber: v.string(),
    licenseImageFrontKey: v.optional(v.string()),
    licenseImageBackKey: v.optional(v.string()),
    organizationId: v.id("organization"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db
      .query("driver")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .first();

    if (driver === null) throw new ConvexError("Driver not found");

    const organization = await ctx.db.get(driver.organizationId);

    if (organization === null) throw new ConvexError("Organization not found");

    if (
      organization.isLicenseVerficationRequired &&
      (!args.licenseImageFrontKey || !args.licenseImageBackKey)
    )
      throw new ConvexError("License images are required");

    const licenseDetailsChanged =
      args.licenseNumber !== driver.licenseNumber ||
      args.licenseImageFrontKey !== driver.licenseImageFrontKey ||
      args.licenseImageBackKey !== driver.licenseImageBackKey;

    if (!organization.canDriverEditLicense && licenseDetailsChanged)
      throw new ConvexError("license details cannot be updated");

    const isLicenseVerified =
      organization.isLicenseVerficationRequired && licenseDetailsChanged
        ? "Pending"
        : "Verified";

    await ctx.db.patch(ctx.user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
    });

    await ctx.db.patch(driver._id, {
      licenseNumber: args.licenseNumber,
      isLicenseVerified: isLicenseVerified,
      licenseImageFrontKey: organization.isLicenseVerficationRequired
        ? args.licenseImageFrontKey
        : undefined,
      licenseImageBackKey: organization.isLicenseVerficationRequired
        ? args.licenseImageBackKey
        : undefined,
      organizationId: args.organizationId,
    });
  },
});

export const uploadProfilePicture = driverMutation({
  args: {
    profilePictureKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.user._id, {
      profilePictureKey: args.profilePictureKey,
    });
  },
});

export const removeProfilePictureKey = driverMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.db.patch(ctx.user._id, {
      profilePictureKey: undefined,
    });
  },
});

export const getDriverPaymentQrImage = driverQuery({
  args: {
    driverId: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (driver === null) throw new ConvexError("Invalid User");
    if (!driver.paymentQrCodeKey) return null;

    const paymentQrCodeUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: process.env.MINIO_BUCKET,
        Key: driver.paymentQrCodeKey,
      }),
      { expiresIn: 300 },
    );
    return paymentQrCodeUrl;
  },
});

export const updatePaymentQrCode = driverMutation({
  args: {
    driverId: v.id("driver"),
    paymentQrCodeKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);

    if (driver === null) throw new ConvexError("Invalid user");

    await ctx.db.patch(driver._id, {
      paymentQrCodeKey: args.paymentQrCodeKey,
    });
  },
});

export const updateLicense = driverMutation({
  args: {
    driverId: v.id("driver"),
    number: v.string(),
    frontImageKey: v.optional(v.string()),
    backImageKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);

    if (driver === null) throw new ConvexError("Driver not found");

    const organisation = await ctx.db.get(driver.organizationId);

    if (organisation === null)
      throw new ConvexError("Driver doesn't belong to any organisation");

    if (
      !organisation.canDriverEditLicense &&
      driver.isLicenseVerified === "Verified"
    )
      throw new ConvexError("Can't update license details");

    if (!organisation.isLicenseVerficationRequired) {
      await ctx.db.patch(driver._id, {
        licenseNumber: args.number,
        licenseImageFrontKey: undefined,
        licenseImageBackKey: undefined,
        isLicenseVerified: "Verified",
      });
      return;
    }

    await ctx.db.patch(driver._id, {
      licenseNumber: args.number,
      licenseImageFrontKey: args.frontImageKey,
      licenseImageBackKey: args.backImageKey,
      isLicenseVerified: organisation.isLicenseVerficationRequired
        ? "Pending"
        : "Verified",
    });
  },
});

export const toggleAvailability = driverMutation({
  args: {
    id: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.id);
    if (driver === null) throw new ConvexError("Invalid user");
    if (driver.isBlacklisted === true) {
      throw new ConvexError(
        "Driver is blacklisted and cannot toggle availability",
      );
    }

    if (driver.isOnline === true) {
      const rideRequests = await ctx.db
        .query("ride")
        .withIndex("by_driver", (q) => q.eq("driverId", driver._id))
        .filter((q) =>
          q.or(
            q.and(
              q.eq(q.field("status"), "Open"),
              q.or(
                q.eq(q.field("requestStatus"), "Pending"),
                q.eq(q.field("requestStatus"), "Accepted"),
              ),
            ),
            q.eq(q.field("status"), "Active"),
          ),
        )
        .collect();

      if (rideRequests.length > 0) {
        if (
          rideRequests.some((r) =>
            ["Driver Arrived", "Active"].includes(r.status),
          ) ||
          rideRequests.some(
            (r) => r.status === "Open" && r.requestStatus === "Accepted",
          )
        ) {
          throw new ConvexError(
            "You have an active ride. Please complete it before going offline.",
          );
        }
        throw new ConvexError(
          "You have pending ride requests. Please reject or accept them before going offline.",
        );
      }
    }

    await ctx.db.patch(driver._id, {
      isAvailableForRide: driver.isOnline ? false : true,
      isOnline: !driver.isOnline,
    });
  },
});

export const toggleGenderMatching = driverMutation({
  args: {
    id: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.id);
    if (driver === null) throw new ConvexError("Invalid user");

    await ctx.db.patch(driver._id, {
      genderMatching: !driver.genderMatching,
    });
  },
});
