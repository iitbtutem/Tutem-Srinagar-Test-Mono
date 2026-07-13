import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
} from "../_generated/server";
import { MAX_ATTEMPTS, OTP_EXPIRY_MS } from "../CONSTANTS";
import { internal } from "../_generated/api";

const SESSION_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000;

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

export const createSession = internalMutation({
  args: {
    userId: v.id("user"),
    phoneNumber: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, { userId, phoneNumber, sessionToken }) => {
    const expiresAt = Date.now() + SESSION_EXPIRY_MS;

    await ctx.db.insert("session", {
      sessionToken,
      userId,
      phoneNumber,
      expiresAt,
    });

    return sessionToken;
  },
});

export const getSessionByToken = internalQuery({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const session = await ctx.db
      .query("session")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", sessionToken))
      .first();

    if (!session) return null;
    if (Date.now() > session.expiresAt) return null;

    return session;
  },
});

export const getUserByPhone = internalQuery({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    return ctx.db
      .query("user")
      .withIndex("by_phoneNumber", (q) => q.eq("phoneNumber", phoneNumber))
      .first();
  },
});

export const deleteSession = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    console.log("Session in deleteSession : ::: ", sessionToken);
    const session = await ctx.runQuery(internal.routes.auth.getSessionByToken, {
      sessionToken,
    });
    if (session === null) return;
    if (session) await ctx.db.delete(session._id);
  },
});

export const getUserByIdInternal = internalQuery({
  args: { userId: v.id("user") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (user === null) throw new ConvexError("User not found");

    const permissions = await ctx.db
      .query("userPermission")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return { ...user, permissions: permissions.map((p) => p.permission) };
  },
});
