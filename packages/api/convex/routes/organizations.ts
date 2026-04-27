import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { VEHICLE_CLASS } from "../CONSTANTS";

// CREATE ORGANISATION
export const createOrganization = mutation({
  args: {
    name: v.string(),
    address: v.string(),
    isLicenseVerficationRequired: v.boolean(),
    isVehicleRCVerificationRequired: v.boolean(),
    canDriverEditLicesnse: v.boolean(),
    canDriverEditVehicle: v.boolean(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("organization", {
      name: args.name,
      address: args.address,
      isLicenseVerficationRequired: args.isLicenseVerficationRequired,
      isVehicleRCVerificationRequired: args.isVehicleRCVerificationRequired,
      canDriverEditLicesnse: args.canDriverEditLicesnse,
      canDriverEditVehicle: args.canDriverEditVehicle,
    });
    return id;
  },
});

// FETCH ALL ORGANISATIONS
export const getAllOrganizations = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("organization").collect();
  },
});

// FETCH SINGLE ORGANISATION by ID
export const getOrganizationById = query({
  args: {
    id: v.id("organization"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// UPDATE ORGANIZATION
export const updateOrganization = mutation({
  args: {
    id: v.id("organization"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    isLicenseVerficationRequired: v.optional(v.boolean()),
    isVehicleRCVerificationRequired: v.optional(v.boolean()),
    canDriverEditLicesnse: v.optional(v.boolean()),
    canDriverEditVehicle: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;

    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error(`Organization with id ${id} not found`);
    }

    const updates = Object.fromEntries(
      Object.entries(fields).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

// DELETE ORGANIZATION
export const deleteOrganization = mutation({
  args: {
    id: v.id("organization"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error(`Organization with id ${args.id} not found`);
    }
    await ctx.db.delete(args.id);
    return { success: true, id: args.id };
  },
});

// INSERT ORGAINIZATION RATE
export const createOrganizationRate = mutation({
  args: {
    vehicleClass: v.union(...VEHICLE_CLASS.map((type) => v.literal(type))),
    baseDistance: v.number(),
    baseDistanceRate: v.number(),
    ratePerKm: v.number(),
    waitingPerMinute: v.number(),
    organizationId: v.id("organization"),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("organizationsRate", {
      vehicleClass: args.vehicleClass,
      baseDistance: args.baseDistance,
      baseDistanceRate: args.baseDistanceRate,
      ratePerKm: args.ratePerKm,
      waitingPerMinute: args.waitingPerMinute,
      organizationId: args.organizationId,
    });
    return id;
  },
});

// FETCH ALL ORGANIZATION RATES by organization
export const getOrganizationRates = query({
  args: {
    organizationId: v.id("organization"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizationsRate")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();
  },
});

// FETCH SINGLE ORGANIZATION by ID
export const getOrganizationRateById = query({
  args: {
    id: v.id("organizationsRate"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// FETCH by organization + vehicle class
export const getOrganizationRateByVehicleClass = query({
  args: {
    organizationId: v.id("organization"),
    vehicleClass: v.union(...VEHICLE_CLASS.map((type) => v.literal(type))),
  },
  handler: async (ctx, args) => {
    const rates = await ctx.db
      .query("organizationsRate")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .filter((q) => q.eq(q.field("vehicleClass"), args.vehicleClass))
      .first();
    return rates;
  },
});

// UPDATE ORGANIZATION RATE
export const updateOrganizationRate = mutation({
  args: {
    id: v.id("organizationsRate"),
    vehicleClass: v.optional(
      v.union(...VEHICLE_CLASS.map((type) => v.literal(type)))
    ),
    baseDistance: v.optional(v.number()),
    baseDistanceRate: v.optional(v.number()),
    ratePerKm: v.optional(v.number()),
    waitingPerMinute: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;

    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error(`Organization rate with id ${id} not found`);
    }

    // Only patch fields that were provided
    const updates = Object.fromEntries(
      Object.entries(fields).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

// DELETE SINGLE ORGANIZATION RATE
export const deleteOrganizationRate = mutation({
  args: {
    id: v.id("organizationsRate"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error(`Organization rate with id ${args.id} not found`);
    }
    await ctx.db.delete(args.id);
    return { success: true, id: args.id };
  },
});

// DELETE ALL rates for an organization
export const deleteAllOrganizationRates = mutation({
  args: {
    organizationId: v.id("organization"),
  },
  handler: async (ctx, args) => {
    const rates = await ctx.db
      .query("organizationsRate")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    await Promise.all(rates.map((rate) => ctx.db.delete(rate._id)));
    return { success: true, deletedCount: rates.length };
  },
});