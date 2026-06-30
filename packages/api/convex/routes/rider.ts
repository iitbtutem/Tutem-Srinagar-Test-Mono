import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const registerExpoPushToken = mutation({
  args: {
    riderId: v.id("rider"),
    expoPushToken: v.string(),
  },
  handler: async (ctx, args) => {
    const rider = await ctx.db.get(args.riderId);
    if (rider === null) return;

    await ctx.db.patch(rider._id, {
      expoPushToken: args.expoPushToken,
    });
  },
});

export const logout = mutation({
  args: {
    riderId: v.id("rider"),
  },
  handler: async (ctx, args) => {
    const rider = await ctx.db.get(args.riderId);
    if (rider === null) return;

    await ctx.db.patch(rider._id, {
      expoPushToken: undefined,
    });
  },
});

export const addRider = mutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
    phoneNumber: v.string(),
    expoPushToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("user")
      .withIndex("by_phoneNumber", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();

    if (existingUser) {
      const existingRider = await ctx.db
        .query("rider")
        .withIndex("by_user", (q) => q.eq("userId", existingUser._id))
        .first();

      if (existingRider) {
        throw new ConvexError(
          "Rider already Registered with this phone number",
        );
      }
    }

    const { expoPushToken, ...userInput } = args;

    let userId = existingUser?._id;
    if (existingUser === null) {
      userId = await ctx.db.insert("user", { ...userInput });
    }

    if (userId === undefined) throw new ConvexError("Failed to create user");

    await ctx.db.insert("rider", {
      isVerified: "Pending",
      userId,
      expoPushToken,
      genderMatching: false,
    });
    await ctx.db.insert("userPermission", {
      userId: userId,
      permission: "Rider",
    });

    return userId;
  },
});

export const registerAsRider = mutation({
  args: {
    userId: v.id("user"),
    expoPushToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (user === null) {
      throw new ConvexError("User not found");
    }

    const existingRider = await ctx.db
      .query("rider")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (existingRider !== null)
      throw new ConvexError("Rider profile already exists");

    await ctx.db.insert("rider", {
      isVerified: "Pending",
      userId: user._id,
      expoPushToken: args.expoPushToken,
      genderMatching: false,
    });
    await ctx.db.insert("userPermission", {
      userId: user._id,
      permission: "Rider",
    });
  },
});

export const getRider = query({
  args: {
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (user === null) return null;

    const rider = await ctx.db
      .query("rider")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

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

    return {
      ...user,
      riderDetails: rider,
      profilePictureKey: profilePictureUri,
    };
  },
});

export const updateRider = mutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new ConvexError("User not found");
    }

    const rider = await ctx.db
      .query("rider")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (rider === null) throw new ConvexError("Rider not found");

    await ctx.db.patch(user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
    });
  },
});

export const uploadProfilePicture = mutation({
  args: {
    userId: v.id("user"),
    profilePictureKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new ConvexError("User not found");
    }
    await ctx.db.patch(user._id, {
      profilePictureKey: args.profilePictureKey,
    });
  },
});

export const removeProfilePictureKey = mutation({
  args: {
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) throw new ConvexError("User not found");

    await ctx.db.patch(user._id, {
      profilePictureKey: undefined,
    });
  },
});

export const toggleGenderMatching = mutation({
  args: {
    id: v.id("rider"),
  },
  handler: async (ctx, args) => {
    const rider = await ctx.db.get(args.id);
    if (rider === null) throw new ConvexError("Invalid user");

    await ctx.db.patch(rider._id, {
      genderMatching: !rider.genderMatching,
    });
  },
});
