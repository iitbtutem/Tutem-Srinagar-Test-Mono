import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (existingUser) {
      throw new Error("User already exists");
    }

    const newUser = await ctx.db.insert("user", { ...args, type: "Driver" });

    return newUser;
  },
});

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
      throw new Error("User already exists");
    }

    const newUser = await ctx.db.insert("user", { ...args, type: "Rider" });

    return newUser;
  },
});

export const getUser = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (user === null) return null;

    let licenseFrontImageUri;
    let licenseBackImageUri;
    if (user.type === "Driver") {
      const licenseFrontImageCommand = new GetObjectCommand({
        Bucket: process.env.MINIO_BUCKET,
        Key: user.licenseImageFrontKey,
      });

      const licenseBackImageCommand = new GetObjectCommand({
        Bucket: process.env.MINIO_BUCKET,
        Key: user.licenseImageBackKey, 
      });

      licenseFrontImageUri = await getSignedUrl(s3Client, licenseFrontImageCommand, { expiresIn: 300 });
      licenseBackImageUri  = await getSignedUrl(s3Client, licenseBackImageCommand,  { expiresIn: 300 });
    }

    const organization = await ctx.db
      .query("organization")
      .filter((q) => q.eq(q.field("_id"), user.organizationId))
      .first();

    return { 
      ...user, 
      organization: organization, 
      licenseImageFrontKey: licenseFrontImageUri, 
      licenseImageBackKey: licenseBackImageUri 
    };
  },
});

export const updateDriver = mutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    dob: v.string(),
    licenseNumber: v.string(),
    organizationId: v.id("organization"),
    gender: v.union(v.literal("Male"), v.literal("Female"), v.literal("Other")),
    phoneNumber: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (!user || user.type !== "Driver") {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
      dob: args.dob,
      licenseNumber: args.licenseNumber,
      organizationId: args.organizationId,
      gender: args.gender,
      phoneNumber: args.phoneNumber,
    });
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

    if (!user || user.type !== "Rider") {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
      dob: args.dob,
      gender: args.gender,
      phoneNumber: args.phoneNumber,
    });
  },
});
