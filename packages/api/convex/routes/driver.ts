import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "../_generated/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const registerExpoPushToken = mutation({
  args: {
    driverId: v.id("driver"),
    expoPushToken: v.string(),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db
      .query("driver")

      .filter((q) => q.eq(q.field("_id"), args.driverId))
      .first();
    if(driver === null) return;

    await ctx.db.patch(driver._id, {
      expoPushToken: args.expoPushToken
    });
  }
});

export const removeExpoPushToken = mutation({
  args: {
    driverId: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db
      .query("driver")

      .filter((q) => q.eq(q.field("_id"), args.driverId))
      .first();
    if(driver === null) return;
    
    await ctx.db.patch(driver._id, {
      expoPushToken: undefined
    });
  }
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
    clerkId: v.string(),
    expoPushToken: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    let existingUser = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (existingUser) {
      const existingDriver = await ctx.db
        .query("driver")
        .filter((q) => q.eq(q.field("userId"), args.clerkId))
        .first();

      if (existingDriver) {
        throw new ConvexError("Driver already Registered");
      }
    }

    const organization = await ctx.db
      .query("organization")
      .filter((q) => q.eq(q.field("_id"), args.organizationId))
      .first();

    if (organization === null) throw new ConvexError("Organization not found");

    let userId = existingUser?._id;
    if (existingUser === null) {
      userId = await ctx.db.insert("user", {
        clerkId: args.clerkId,
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
      userId,
      organizationId: args.organizationId,
      licenseImageBackKey: args.licenseImageBackKey,
      licenseImageFrontKey: args.licenseImageFrontKey,
      licenseNumber: args.licenseNumber,
      isAvailableForRide: true,
      isOnline: true,
      isLicenseVerified: organization.isLicenseVerficationRequired
        ? "Pending"
        : "Verified",
      expoPushToken: args.expoPushToken,
      genderMatching: false,
    });

    return;
  },
});

export const registerAsDriver = mutation({
  args: {
    clerkId: v.string(),
    licenseNumber: v.string(),
    licenseImageFrontKey: v.optional(v.string()),
    licenseImageBackKey: v.optional(v.string()),
    organizationId: v.id("organization"),
    expoPushToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();
    if (user === null) {
      throw new ConvexError("User not found");
    }

    const existingDriver = await ctx.db
      .query("driver")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();
    if (existingDriver !== null)
      throw new ConvexError("Driver profile already exists");

    const organization = await ctx.db
      .query("organization")
      .filter((q) => q.eq(q.field("_id"), args.organizationId))
      .first();

    if (organization === null) throw new ConvexError("Organization not found");

    await ctx.db.insert("driver", {
      userId: user._id,
      licenseNumber: args.licenseNumber,
      isAvailableForRide: true,
      isOnline: true,
      licenseImageFrontKey: args.licenseImageFrontKey,
      licenseImageBackKey: args.licenseImageBackKey,
      isLicenseVerified: organization.isLicenseVerficationRequired
        ? "Pending"
        : "Verified",
      organizationId: args.organizationId,
      expoPushToken: args.expoPushToken,
      genderMatching: false,
    });
    await ctx.db.insert("userPermission", {
      userId: user._id,
      permission: "Rider",
    });
  },
});

export const getDriver = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (user === null) return null;

    const driver = await ctx.db
      .query("driver")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

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

    const organization = await ctx.db
      .query("organization")
      .filter((q) => q.eq(q.field("_id"), driver?.organizationId))
      .first();

    if(driver === null) return;
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
      ...user,
      profilePictureKey: profilePictureUri,
      driverDetails: driver ? {
        ...driver,
        organization: organization,
        licenseImageFrontKey: licenseFrontImageUri,
        licenseImageBackKey: licenseBackImageUri,
        averageRating,
        totalRatings: ratings.length
      } : null,
    };
  },
});

export const getDriverExpoPushToken = internalQuery({
  args: {
    id: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.id);
    if(driver === null) throw new ConvexError("Invalid Driver");
    return driver.expoPushToken;
  }
});

export const updateDriver = mutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    licenseNumber: v.string(),
    licenseImageFrontKey: v.optional(v.string()),
    licenseImageBackKey: v.optional(v.string()),
    organizationId: v.id("organization"),
    phoneNumber: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (user === null) throw new ConvexError("User not found");

    const driver = await ctx.db
      .query("driver")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (driver === null) throw new ConvexError("Driver not found");

    const organization = await ctx.db
      .query("organization")
      .filter((q) => q.eq(q.field("_id"), args.organizationId))
      .first();

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

    if (!organization.canDriverEditLicesnse && licenseDetailsChanged)
      throw new ConvexError("license details cannot be updated");

    const isLicenseVerified =
      organization.isLicenseVerficationRequired && licenseDetailsChanged
        ? "Pending"
        : "Verified";

    await ctx.db.patch(user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
      phoneNumber: args.phoneNumber,
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

export const uploadProfilePicture = mutation({
  args: {
    clerkId: v.string(),
    profilePictureKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (user === null) throw new ConvexError("User not found");

    await ctx.db.patch(user._id, {
      profilePictureKey: args.profilePictureKey,
    });
  },
});

export const removeProfilePictureKey = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (user === null) throw new ConvexError("User not found");

    await ctx.db.patch(user._id, {
      profilePictureKey: undefined,
    });
  },
});

export const updateLicense = mutation({
  args: {
    driverId: v.id("driver"),
    number: v.string(),
    frontImageKey: v.optional(v.string()),
    backImageKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db
      .query("driver")
      .filter((q) => q.eq(q.field("_id"), args.driverId))
      .first();

    if (!driver) throw new ConvexError("Driver not found");

    const organisation = await ctx.db
      .query("organization")
      .filter((q) => q.eq(q.field("_id"), driver.organizationId))
      .first();

    if (organisation === null)
      throw new ConvexError("Driver doesn't belong to any organisation");

    if (!organisation.canDriverEditLicesnse && driver.isLicenseVerified === "Verified")
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

export const toggleAvailability = mutation({
  args: {
    id: v.id("driver")
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.id);
    if(driver === null) throw new ConvexError("Invalid user");

    const rideRequests = await ctx.db
    .query("ride")
    .filter((q) => q.and(
      q.eq(q.field("driverId"), driver._id),
      q.eq(q.field("status"), "Open")
    ))
    .collect();

    if(driver.isOnline === true){
      for(const ride of rideRequests){
        await ctx.db.patch(ride._id, {
          requestStatus: "Rejected"
        })
      };
    };

    await ctx.db.patch(driver._id, {
      isAvailableForRide: driver.isOnline ? false : true,
      isOnline: !driver.isOnline,
    });
  }
})

export const toggleGenderMatching = mutation({
  args: {
    id: v.id("driver")
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.id);
    if(driver === null) throw new ConvexError("Invalid user");

    await ctx.db.patch(driver._id, {
      genderMatching: !driver.genderMatching
    })
  }
})