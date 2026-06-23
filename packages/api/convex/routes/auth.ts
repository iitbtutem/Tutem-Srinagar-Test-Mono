import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { MAX_ATTEMPTS, OTP_EXPIRY_MS } from "../CONSTANTS";

export const upsertOtpSession = internalMutation({
  args: {
    phoneNumber: v.string(),
    hashedOtp: v.string(),
  },
  handler: async (ctx, { phoneNumber, hashedOtp }) => {
    const existing = await ctx.db
      .query("otpSession")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phoneNumber))
      .first();

    const expiresAt = Date.now() + OTP_EXPIRY_MS * 1000 * 60;

    if (existing) {
      await ctx.db.patch(existing._id, { hashedOtp, expiresAt, attempts: 0 });
    } else {
      await ctx.db.insert("otpSession", {
        phoneNumber,
        hashedOtp,
        expiresAt,
        attempts: 0,
      });
    }
  },
});

export const getOtpSession = internalQuery({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    return ctx.db
      .query("otpSession")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phoneNumber))
      .first();
  },
});

export const deleteOtpSession = internalMutation({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    const session = await ctx.db
      .query("otpSession")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phoneNumber))
      .first();
    if (session) await ctx.db.delete(session._id);
  },
});

export const incrementAttempts = internalMutation({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    const session = await ctx.db
      .query("otpSession")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phoneNumber))
      .first();
    if (!session) return;

    if (session.attempts + 1 >= MAX_ATTEMPTS) {
      await ctx.db.delete(session._id);
    } else {
      await ctx.db.patch(session._id, { attempts: session.attempts + 1 });
    }
  },
});
