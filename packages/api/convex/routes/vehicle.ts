import { ConvexError, v } from "convex/values";
import { driverMutation, driverQuery } from "../helpers/sessionFunctions";
import { FUEL_TYPE, VEHICLE_CLASS, VEHICLE_TYPE } from "../CONSTANTS";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const getVehicleByDriverId = driverQuery({
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

    const insuranceImageKey = vehicle.insuranceImageKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: vehicle.insuranceImageKey,
          }),
          { expiresIn: 300 },
        )
      : undefined;

    return { ...vehicle, rcImageKey, insuranceImageKey };
  },
});

export const addVehicle = driverMutation({
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
    insuranceImageKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.seatingCapacity < 2 || args.seatingCapacity > 50)
      throw new ConvexError("Invalid seating capacity");

    const driver = await ctx.db.get(args.ownerId);

    if (driver === null) throw new ConvexError("Driver not found.");

    const organization = await ctx.db.get(driver.organizationId);

    if (organization === null)
      throw new ConvexError("Driver not assigned to any organization.");

    if (organization.isVehicleRCVerificationRequired && !args.rcImageKey)
      throw new ConvexError("Vehicle RC required");
    if (organization.isVehicleInsuranceImageRequired && !args.insuranceImageKey)
      throw new ConvexError("Vehicle Insurance is required");

    const existingVehicle = await ctx.db
      .query("vehicle")
      .withIndex("by_registrationNumber", (q) =>
        q.eq("registrationNumber", args.registrationNumber),
      )
      .first();

    if (existingVehicle) {
      throw new ConvexError("Vehicle already exists");
    }

    const userExistingVehicle = await ctx.db
      .query("vehicle")
      .withIndex("by_owner", (q) => q.eq("ownerId", driver._id))
      .first();
    if (userExistingVehicle !== null)
      throw new ConvexError("Vehicle already registered for the driver");

    const newVehicle = await ctx.db.insert("vehicle", {
      ...args,
      isVerified: organization.isVehicleRCVerificationRequired
        ? "Unverified"
        : "Verified",
    });

    return newVehicle;
  },
});

export const updateVehicle = driverMutation({
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
    insuranceImageKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...input } = args;
    const vehicle = await ctx.db.get(args.id);
    if (vehicle === null) throw new ConvexError("Vehicle not found");

    if (args.seatingCapacity < 2 || args.seatingCapacity > 50)
      throw new ConvexError("Invalid seating capacity");

    const driver = await ctx.db.get(vehicle.ownerId);

    if (driver === null) throw new ConvexError("Driver not found");

    const organization = await ctx.db.get(driver.organizationId);

    if (organization === null)
      throw new ConvexError("Driver not assigned to any organization");

    if (
      organization.canDriverEditVehicle === false &&
      vehicle.isVerified === "Verified"
    )
      throw new ConvexError("Vehicle can't be updated");

    if (organization.isVehicleRCVerificationRequired && !input.rcImageKey)
      throw new ConvexError("Vehicle RC is required");
    if (
      organization.isVehicleInsuranceImageRequired &&
      !input.insuranceImageKey
    )
      throw new ConvexError("Vehicle insurance is required");

    await ctx.db.patch(vehicle._id, {
      ...input,
      isVerified: organization.isVehicleRCVerificationRequired
        ? "Unverified"
        : "Verified",
      rcImageKey: organization.isVehicleRCVerificationRequired
        ? input.rcImageKey
        : undefined,
      insuranceImageKey: organization.isVehicleRCVerificationRequired
        ? input.insuranceImageKey
        : undefined,
    });
  },
});
