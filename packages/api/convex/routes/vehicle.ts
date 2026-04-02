import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { FUEL_TYPE, VEHICLE_CLASS, VEHICLE_TYPE } from "../CONSTANTS";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const getVehicleByDriverId = query({
  args: { driverId: v.id("driver") },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db
      .query("vehicle")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.driverId))
      .first();

    if (vehicle === null) return vehicle;

    const rcImageKey = vehicle.rcImageKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: vehicle.rcImageKey,
          }),
          { expiresIn: 300 },
        )
      : undefined;

    return { ...vehicle, rcImageKey };
  },
});

export const addVehicle = mutation({
  args: {
    registrationNumber: v.string(),
    model: v.string(),
    type: v.union(...VEHICLE_TYPE.map((type) => v.literal(type))),
    fuelType: v.union(...FUEL_TYPE.map((type) => v.literal(type))),
    class: v.union(...VEHICLE_CLASS.map((type) => v.literal(type))),
    color: v.string(),
    seatingCapacity: v.number(),
    ownerId: v.id("driver"),
    rcImageKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.seatingCapacity < 2 || args.seatingCapacity > 50)
      throw new ConvexError("Invalid seating capacity");

    const driver = await ctx.db
      .query("driver")
      .filter((q) => q.eq(q.field("_id"), args.ownerId))
      .first();

    if (driver === null) throw new ConvexError("Driver not found.");

    const organization = await ctx.db
      .query("organization")
      .filter((q) => q.eq(q.field("_id"), driver.organizationId))
      .first();

    if (organization === null)
      throw new ConvexError("Driver not assigned to any organization.");

    if (organization.isVehicleRegistrationRequired && !args.rcImageKey)
      throw new ConvexError("Vehicle RC required");

    const existingVehicle = await ctx.db
      .query("vehicle")
      .filter((q) =>
        q.eq(q.field("registrationNumber"), args.registrationNumber),
      )
      .first();

    if (existingVehicle) {
      throw new Error("Vehicle already exists");
    }

    const userExistingVehicle = await ctx.db
      .query("vehicle")
      .filter((q) => q.eq(q.field("ownerId"), driver._id))
      .first();
    if (userExistingVehicle !== null)
      throw new ConvexError("Vehicle already registered for the driver");

    const newVehicle = await ctx.db.insert("vehicle", {
      ...args,
      isVerified:
        organization.isVehicleRegistrationRequired &&
        organization.isVehicleRCVerificationRequired
          ? "Pending"
          : "Verified",
    });

    return newVehicle;
  },
});

export const updateVehicle = mutation({
  args: {
    id: v.id("vehicle"),
    registrationNumber: v.string(),
    model: v.string(),
    type: v.union(...VEHICLE_TYPE.map((type) => v.literal(type))),
    fuelType: v.union(...FUEL_TYPE.map((type) => v.literal(type))),
    class: v.union(...VEHICLE_CLASS.map((type) => v.literal(type))),
    color: v.string(),
    seatingCapacity: v.number(),
    rcImageKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...input } = args;
    const vehicle = await ctx.db
      .query("vehicle")
      .filter((q) => q.eq(q.field("_id"), id))
      .first();
    if (vehicle === null) throw new ConvexError("Vehicle not found");

    const driver = await ctx.db
      .query("driver")
      .filter((q) => q.eq(q.field("_id"), vehicle.ownerId))
      .first();
    if (driver === null) throw new ConvexError("Driver not found");

    const organization = await ctx.db
      .query("organization")
      .filter((q) => q.eq(q.field("_id"), driver.organizationId))
      .first();
    if (organization === null)
      throw new ConvexError("Driver not assigned to any organization");
    if (organization.canDriverEditVehicle === false)
      throw new ConvexError("Vehicle can't be updated");

    if (organization.isVehicleRegistrationRequired && !input.rcImageKey)
      throw new ConvexError("Vehicle RC is required");

    await ctx.db.patch(vehicle._id, {
      ...input,
      isVerified:
        organization.isVehicleRegistrationRequired &&
        organization.isVehicleRCVerificationRequired
          ? "Pending"
          : "Verified",
      rcImageKey: organization.isVehicleRegistrationRequired
        ? input.rcImageKey
        : "",
    });
  },
});
