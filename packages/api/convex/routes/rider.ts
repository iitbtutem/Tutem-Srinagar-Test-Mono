import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { useMutation } from "convex/react";

export const addRider = mutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
    phoneNumber: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (existingUser) {
      throw new ConvexError("User already exists");
    }

    const userId = await ctx.db.insert("user", { ...args });
    await ctx.db.insert("rider", { isVerified: "Pending", userId });
    await ctx.db.insert("userPermission", { userId: userId, permission: 'Rider' })

    return userId;
  },
});

export const registerAsRider = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();
    if (user === null) {
      throw new ConvexError("User not found");
    };

    const existingRider = await ctx.db.query("rider")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();
    if (existingRider !== null) throw new ConvexError("Rider profile already exists");

    await ctx.db.insert("rider", { isVerified: "Pending", userId: user._id });
    await ctx.db.insert("userPermission", { userId: user._id, permission: 'Rider' });
  }
})

export const getRider = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (user === null) return null;

    const rider = await ctx.db
      .query("rider")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

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
    dob: v.string(),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
    phoneNumber: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const rider = await ctx.db
      .query("rider")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (rider === null) throw new ConvexError("Rider not found");

    await ctx.db.patch(user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
      dob: args.dob,
      gender: args.gender,
      phoneNumber: args.phoneNumber,
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

    if (!user) {
      throw new ConvexError("User not found");
    };
    await ctx.db.patch(user._id, {
      profilePictureKey: args.profilePictureKey
    });

  }
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

    if (!user) throw new ConvexError("User not found");

    await ctx.db.patch(user._id, {
      profilePictureKey: undefined,
    });
  },
});
