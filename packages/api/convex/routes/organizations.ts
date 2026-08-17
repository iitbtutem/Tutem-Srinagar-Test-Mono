import { ConvexError, v } from "convex/values";
import { internalQuery, query } from "../_generated/server";
import { VEHICLE_CLASS } from "../CONSTANTS";
import { isPointInsidePolygon } from "../helpers/maps";
import {
  adminMutation,
  adminQuery,
  authenticatedMutation,
} from "../helpers/sessionFunctions";

// CREATE ORGANISATION
export const createOrganization = adminMutation({
  args: {
    name: v.string(),
    address: v.string(),
    isLicenseVerficationRequired: v.boolean(),
    isVehicleRCVerificationRequired: v.boolean(),
    isVehicleInsuranceImageRequired: v.boolean(),
    canDriverEditLicense: v.boolean(),
    canDriverEditVehicle: v.boolean(),
    polygon: v.optional(
      v.array(
        v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),
      ),
    ),
    boundingBox: v.optional(
      v.object({
        north: v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),

        south: v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),

        east: v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),

        west: v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organization")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();
    if (existing) {
      throw new ConvexError("Organization already exists");
    }

    const id = await ctx.db.insert("organization", {
      name: args.name,
      address: args.address,
      isLicenseVerficationRequired: args.isLicenseVerficationRequired,
      isVehicleRCVerificationRequired: args.isVehicleRCVerificationRequired,
      canDriverEditLicense: args.canDriverEditLicense,
      canDriverEditVehicle: args.canDriverEditVehicle,
      isVehicleInsuranceImageRequired: args.isVehicleInsuranceImageRequired,
      polygon: args.polygon,
      boundingBox: args.boundingBox,
    });
    return id;
  },
});

// FETCH ALL ORGANISATIONS
export const getAllOrganizations = adminQuery({
  args: {
    search: v.optional(v.string()),
    licenseRequired: v.optional(v.array(v.string())),
    rcRequired: v.optional(v.array(v.string())),
    hasPolygon: v.optional(v.array(v.string())),
    status: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const orgs = await ctx.db.query("organization").collect();

    return orgs.filter((org) => {
      if (args.search) {
        const s = args.search.toLowerCase();
        const matchesName = org.name?.toLowerCase().includes(s);
        const matchesAddress = org.address?.toLowerCase().includes(s);
        if (!matchesName && !matchesAddress) return false;
      }
      if (args.licenseRequired && args.licenseRequired.length > 0) {
        const hasYes = args.licenseRequired.includes("Yes");
        const hasNo = args.licenseRequired.includes("No");
        if (hasYes && !hasNo && !org.isLicenseVerficationRequired) return false;
        if (hasNo && !hasYes && org.isLicenseVerficationRequired) return false;
      }
      if (args.rcRequired && args.rcRequired.length > 0) {
        const hasYes = args.rcRequired.includes("Yes");
        const hasNo = args.rcRequired.includes("No");
        if (hasYes && !hasNo && !org.isVehicleRCVerificationRequired) return false;
        if (hasNo && !hasYes && org.isVehicleRCVerificationRequired) return false;
      }
      if (args.hasPolygon && args.hasPolygon.length > 0) {
        const hasDefined = args.hasPolygon.includes("Defined");
        const hasNone = args.hasPolygon.includes("None");
        const orgHas = !!((org.polygon && org.polygon.length > 0) || org.boundingBox);
        if (hasDefined && !hasNone && !orgHas) return false;
        if (hasNone && !hasDefined && orgHas) return false;
      }
      if (args.status && args.status.length > 0) {
        const hasActive = args.status.includes("Active");
        const hasSuspended = args.status.includes("Suspended");
        const isSuspended = org.isSuspended === true;
        if (hasActive && !hasSuspended && isSuspended) return false;
        if (hasSuspended && !hasActive && !isSuspended) return false;
      }
      return true;
    });
  },
});

export const getNearbyOrganization = query({
  args: {
    driverLocation: v.object({
      latitude: v.number(),
      longitude: v.number(),
    }),
  },

  handler: async (ctx, args) => {
    const candidateOrganizations = await ctx.db
      .query("organization")
      .filter((q) =>
        q.or(
          q.eq(q.field("boundingBox"), undefined),
          q.and(
            // latitude
            q.gte(
              q.field("boundingBox.north.latitude"),
              args.driverLocation.latitude,
            ),
            q.lte(
              q.field("boundingBox.south.latitude"),
              args.driverLocation.latitude,
            ),

            // longitude
            q.gte(
              q.field("boundingBox.east.longitude"),
              args.driverLocation.longitude,
            ),
            q.lte(
              q.field("boundingBox.west.longitude"),
              args.driverLocation.longitude,
            ),
          ),
        ),
      )
      .collect();

    const organizations = candidateOrganizations.filter((org) => {
      if (org.isSuspended === true) return false;

      // If no polygon, allow by default
      if (
        (!org.boundingBox && !org.polygon) ||
        !org.polygon ||
        org.polygon.length < 3
      ) {
        return true;
      }

      return isPointInsidePolygon(args.driverLocation, org.polygon);
    });

    return organizations;
  },
});

// TOGGLE SUSPEND ORGANIZATION
export const toggleSuspendOrganization = adminMutation({
  args: {
    id: v.id("organization"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmedReason = args.reason.trim();
    if (!trimmedReason) {
      throw new ConvexError("Reason is required to suspend or unsuspend organization");
    }

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError(`Organization with id ${args.id} not found`);
    }

    const isCurrentlySuspended = existing.isSuspended === true;
    if (isCurrentlySuspended) {
      await ctx.db.patch(args.id, {
        isSuspended: false,
        suspendedReason: undefined,
        suspendedAt: undefined,
        suspendedByAdminId: undefined,
      });
    } else {
      await ctx.db.patch(args.id, {
        isSuspended: true,
        suspendedReason: trimmedReason,
        suspendedAt: Date.now(),
        suspendedByAdminId: ctx.user._id,
      });
    }

    return await ctx.db.get(args.id);
  },
});

// FETCH SINGLE ORGANISATION by ID
export const getOrganizationById = adminQuery({
  args: {
    id: v.id("organization"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// UPDATE ORGANIZATION
export const updateOrganization = adminMutation({
  args: {
    id: v.id("organization"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    isLicenseVerficationRequired: v.optional(v.boolean()),
    isVehicleRCVerificationRequired: v.optional(v.boolean()),
    isVehicleInsuranceImageRequired: v.optional(v.boolean()),
    canDriverEditLicense: v.optional(v.boolean()),
    canDriverEditVehicle: v.optional(v.boolean()),
    polygon: v.optional(
      v.array(
        v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),
      ),
    ),
    boundingBox: v.optional(
      v.object({
        north: v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),

        south: v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),

        east: v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),

        west: v.object({
          latitude: v.number(),
          longitude: v.number(),
        }),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { id, polygon, boundingBox, ...fields } = args;

    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new ConvexError(`Organization with id ${id} not found`);
    }

    const updates = Object.fromEntries(
      Object.entries(fields).filter(([_, v]) => v !== undefined),
    );

    await ctx.db.patch(id, {
      ...updates,
      polygon: polygon,
      boundingBox: boundingBox,
    });
    return await ctx.db.get(id);
  },
});

// DELETE ORGANIZATION
export const deleteOrganization = adminMutation({
  args: {
    id: v.id("organization"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError(`Organization with id ${args.id} not found`);
    }
    await ctx.db.delete(args.id);
    await ctx.db
      .query("organizationsRate")
      .filter((q) => q.eq(q.field("organizationId"), args.id))
      .collect()
      .then((rates) =>
        Promise.all(rates.map((rate) => ctx.db.delete(rate._id))),
      );
    await ctx.db
      .query("driver")
      .filter((q) => q.eq(q.field("organizationId"), args.id))
      .collect()
      .then((drivers) =>
        Promise.all(drivers.map((driver) => ctx.db.delete(driver._id))),
      );
    return { success: true, id: args.id };
  },
});

// INSERT ORGAINIZATION RATE
export const createOrganizationRate = adminMutation({
  args: {
    vehicleClass: v.union(...VEHICLE_CLASS.map((type) => v.literal(type))),
    baseDistance: v.number(),
    baseDistanceRate: v.number(),
    ratePerKm: v.number(),
    waitingPerMinute: v.number(),
    organizationId: v.id("organization"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizationsRate")
      .filter((q) =>
        q.and(
          q.eq(q.field("organizationId"), args.organizationId),
          q.eq(q.field("vehicleClass"), args.vehicleClass),
        ),
      )
      .first();

    if (existing) {
      throw new ConvexError(
        "Organization rate already exists for this organization and vehicle class",
      );
    }
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
export const getOrganizationRates = adminQuery({
  args: {
    organizationId: v.id("organization"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizationsRate")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
  },
});

// FETCH SINGLE ORGANIZATION by ID
export const getOrganizationRateById = adminQuery({
  args: {
    id: v.id("organizationsRate"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// FETCH by organization + vehicle class
export const getOrganizationRateByVehicleClass = adminQuery({
  args: {
    organizationId: v.id("organization"),
    vehicleClass: v.union(...VEHICLE_CLASS.map((type) => v.literal(type))),
  },
  handler: async (ctx, args) => {
    const rates = await ctx.db
      .query("organizationsRate")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("vehicleClass"), args.vehicleClass))
      .first();
    return rates;
  },
});

// UPDATE ORGANIZATION RATE
export const updateOrganizationRate = adminMutation({
  args: {
    id: v.id("organizationsRate"),
    vehicleClass: v.optional(
      v.union(...VEHICLE_CLASS.map((type) => v.literal(type))),
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
      throw new ConvexError(`Organization rate with id ${id} not found`);
    }

    // Only patch fields that were provided
    const updates = Object.fromEntries(
      Object.entries(fields).filter(([_, v]) => v !== undefined),
    );

    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

// DELETE SINGLE ORGANIZATION RATE
export const deleteOrganizationRate = adminMutation({
  args: {
    id: v.id("organizationsRate"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError(`Organization rate with id ${args.id} not found`);
    }
    await ctx.db.delete(args.id);
    return { success: true, id: args.id };
  },
});

// DELETE ALL rates for an organization
export const deleteAllOrganizationRates = adminMutation({
  args: {
    organizationId: v.id("organization"),
  },
  handler: async (ctx, args) => {
    const rates = await ctx.db
      .query("organizationsRate")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect()
      .then(async (rates) => {
        await Promise.all(rates.map((rate) => ctx.db.delete(rate._id)));
        return rates;
      });

    return rates;
  },
});

export const getOrganizationRatesInternal = internalQuery({
  args: {
    organizationId: v.id("organization"),
  },
  handler: async (ctx, args) => {
    const rates = await ctx.db
      .query("organizationsRate")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
    return rates;
  },
});
