import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import {
  authenticatedQuery,
  authenticatedMutation,
  riderMutation,
  riderQuery,
} from "../helpers/sessionFunctions";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { validateAge, getAgeSettingsOrThrow } from "../helpers/validation";

export const registerExpoPushToken = riderMutation({
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
    // Validate rider age based on DB settings
    const ageSettings = await getAgeSettingsOrThrow(ctx);
    validateAge(args.dob, ageSettings.minRiderAge, ageSettings.maxRiderAge, "Rider");

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
      isVerified: "Unverified",
      userId,
      genderMatching: false,
      isBlacklisted: false,
      ...(expoPushToken !== undefined ? { expoPushToken } : {}),
    });
    await ctx.db.insert("userPermission", {
      userId: userId,
      permission: "Rider",
    });

    return userId;
  },
});

export const registerAsRider = riderMutation({
  args: {
    expoPushToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingRider = await ctx.db
      .query("rider")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .first();
    if (existingRider !== null)
      throw new ConvexError("Rider profile already exists");

    // Validate rider age based on DB settings (user already exists with DOB)
    const ageSettings = await getAgeSettingsOrThrow(ctx);
    validateAge(ctx.user.dob, ageSettings.minRiderAge, ageSettings.maxRiderAge, "Rider");

    await ctx.db.insert("rider", {
      isVerified: "Unverified",
      userId: ctx.user._id,
      genderMatching: false,
      isBlacklisted: false,
      ...(args.expoPushToken !== undefined ? { expoPushToken: args.expoPushToken } : {}),
    });
    await ctx.db.insert("userPermission", {
      userId: ctx.user._id,
      permission: "Rider",
    });
  },
});

export const getRider = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const rider = await ctx.db
      .query("rider")
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

    return {
      ...ctx.user,
      riderDetails: rider,
      profilePictureKey: profilePictureUri,
    };
  },
});

export const updateRider = riderMutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const rider = await ctx.db
      .query("rider")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .first();

    if (rider === null) throw new ConvexError("Rider not found");

    await ctx.db.patch(ctx.user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
    });
  },
});

export const uploadProfilePicture = riderMutation({
  args: {
    profilePictureKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.user._id, {
      profilePictureKey: args.profilePictureKey,
    });
  },
});

export const removeProfilePictureKey = riderMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.db.patch(ctx.user._id, {
      profilePictureKey: undefined,
    });
  },
});

export const toggleGenderMatching = riderMutation({
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

/**
 * Saves a location to the rider's recent searches.
 * - Deduplicates by title (same title → remove old entry first)
 * - Keeps only the 5 most recent entries (trims the oldest)
 */
export const saveRecentLocation = riderMutation({
  args: {
    riderId: v.id("rider"),
    title: v.string(),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const { riderId, title, latitude, longitude } = args;

    // Remove any existing entry with the same title for this rider (dedup)
    const existing = await ctx.db
      .query("riderRecentLocation")
      .withIndex("by_rider", (q) => q.eq("riderId", riderId))
      .collect();

    const duplicate = existing.find((e) => e.title === title);
    if (duplicate) {
      await ctx.db.delete(duplicate._id);
    }

    // Insert the new entry (_creationTime is set automatically by Convex)
    await ctx.db.insert("riderRecentLocation", {
      riderId,
      title,
      latitude,
      longitude,
    });

    // Trim to 5: fetch all again sorted by _creationTime desc, delete extras
    const all = await ctx.db
      .query("riderRecentLocation")
      .withIndex("by_rider", (q) => q.eq("riderId", riderId))
      .order("desc")
      .collect();

    const toDelete = all.slice(5);
    for (const entry of toDelete) {
      await ctx.db.delete(entry._id);
    }
  },
});

/**
 * Returns the last 5 searched locations for a rider, newest first.
 */
export const getRecentLocations = riderQuery({
  args: {
    riderId: v.id("rider"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("riderRecentLocation")
      .withIndex("by_rider", (q) => q.eq("riderId", args.riderId))
      .order("desc")
      .take(5);
  },
});

