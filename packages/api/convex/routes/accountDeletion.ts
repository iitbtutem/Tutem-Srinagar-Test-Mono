import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type DatabaseReader,
} from "../_generated/server";
import {
  coversScope,
  deletionScope,
  mergeScope,
  OTP_ATTEMPT_LIMIT,
  OTP_COOLDOWN_MS,
  OTP_LIFETIME_MS,
  OTP_SEND_LIMIT,
  OTP_WINDOW_MS,
  type DeletionScope,
} from "../helpers/accountDeletion";

async function getIntake(db: DatabaseReader, phoneNumber: string) {
  const request = await db
    .query("accountDeletionRequest")
    .withIndex("by_phone", (q) => q.eq("phoneNumber", phoneNumber))
    .unique();
  const user = await db
    .query("user")
    .withIndex("by_phoneNumber", (q) => q.eq("phoneNumber", phoneNumber))
    .first();
  const rider =
    user &&
    (await db
      .query("rider")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first());
  const driver =
    user &&
    (await db
      .query("driver")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first());
  const availableScope: DeletionScope | null =
    rider && driver ? "Both" : rider ? "Rider" : driver ? "Driver" : null;
  const remainingScope: DeletionScope | null =
    !availableScope ||
    request?.scope === "Both" ||
    request?.scope === availableScope
      ? null
      : availableScope === "Both" && request
        ? request.scope === "Rider"
          ? "Driver"
          : "Rider"
        : availableScope;
  return { request, availableScope, remainingScope };
}

export const getIntakeState = internalQuery({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    const state = await getIntake(ctx.db, phoneNumber);
    return {
      ...state,
      request: state.request
        ? { scope: state.request.scope, status: state.request.status }
        : null,
    };
  },
});

export const getStatus = internalQuery({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    const request = await ctx.db
      .query("accountDeletionRequest")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phoneNumber))
      .unique();
    // Public by design: never return the reason, phone, or account information.
    return request ? { scope: request.scope, status: request.status } : null;
  },
});

export const prepareOtp = internalMutation({
  args: {
    phoneNumber: v.string(),
    extend: v.optional(v.boolean()),
    challengeId: v.string(),
    hashedOtp: v.string(),
  },
  handler: async (ctx, args) => {
    const { request, availableScope, remainingScope } = await getIntake(
      ctx.db,
      args.phoneNumber,
    );
    if (request && (!args.extend || !remainingScope)) {
      return {
        kind: "existing" as const,
        request: { scope: request.scope, status: request.status },
        remainingScope,
      };
    }
    const scope = request ? remainingScope : availableScope;
    if (!scope) return { kind: "not_found" as const };
    const now = Date.now();
    const previous = await ctx.db
      .query("accountDeletionOtp")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .unique();
    const sameWindow =
      previous && now - previous.windowStartedAt < OTP_WINDOW_MS;
    const retryAt =
      previous &&
      Math.max(
        previous.sentAt + OTP_COOLDOWN_MS,
        sameWindow && previous.sendCount >= OTP_SEND_LIMIT
          ? previous.windowStartedAt + OTP_WINDOW_MS
          : 0,
      );
    if (retryAt && retryAt > now) {
      return {
        kind: "limited" as const,
        retryAfterSeconds: Math.ceil((retryAt - now) / 1000),
      };
    }
    const values = {
      phoneNumber: args.phoneNumber,
      challengeId: args.challengeId,
      hashedOtp: args.hashedOtp,
      scope,
      attempts: 0,
      expiresAt: now + OTP_LIFETIME_MS,
      sentAt: now,
      windowStartedAt: sameWindow ? previous.windowStartedAt : now,
      sendCount: sameWindow ? previous.sendCount + 1 : 1,
    };
    if (previous) await ctx.db.patch(previous._id, values);
    else await ctx.db.insert("accountDeletionOtp", values);
    return {
      kind: "otp" as const,
      challengeId: args.challengeId,
      availableScope: scope,
      expiresInSeconds: 300,
      retryAfterSeconds: 60,
    };
  },
});

export const invalidateOtp = internalMutation({
  args: { phoneNumber: v.string(), challengeId: v.string() },
  handler: async (ctx, args) => {
    const challenge = await ctx.db
      .query("accountDeletionOtp")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .unique();
    if (challenge?.challengeId === args.challengeId) {
      // Preserve the quota even when delivery fails.
      await ctx.db.patch(challenge._id, { hashedOtp: "", expiresAt: 0 });
    }
  },
});

export const submit = internalMutation({
  args: {
    phoneNumber: v.string(),
    scope: deletionScope,
    challengeId: v.string(),
    hashedOtp: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("accountDeletionRequest")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .unique();
    if (existing && coversScope(existing.scope, args.scope)) {
      return { request: { scope: existing.scope, status: existing.status } };
    }
    const { availableScope } = await getIntake(ctx.db, args.phoneNumber);
    if (!availableScope || !coversScope(availableScope, args.scope)) {
      return {
        error:
          "The selected account isn't registered with this number. Please start again.",
      };
    }
    const challenge = await ctx.db
      .query("accountDeletionOtp")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .unique();
    if (
      !challenge ||
      challenge.challengeId !== args.challengeId ||
      !coversScope(challenge.scope, args.scope) ||
      challenge.expiresAt <= Date.now() ||
      challenge.attempts >= OTP_ATTEMPT_LIMIT
    ) {
      return {
        error:
          "This code has expired or is no longer valid. Request a new code.",
      };
    }
    if (challenge.hashedOtp !== args.hashedOtp) {
      await ctx.db.patch(challenge._id, { attempts: challenge.attempts + 1 });
      // Return rather than throw, so the attempt counter commits.
      return {
        error:
          challenge.attempts + 1 >= OTP_ATTEMPT_LIMIT
            ? "Too many incorrect attempts. Request a new code."
            : "Incorrect verification code. Please try again.",
      };
    }
    const now = Date.now();
    const scope = existing
      ? mergeScope(existing.scope, args.scope)
      : args.scope;
    const values = {
      scope,
      status: "Requested" as const,
      confirmedAt: now,
      updatedAt: now,
      ...(args.reason ? { reason: args.reason } : {}),
    };
    if (existing) await ctx.db.patch(existing._id, values);
    else
      await ctx.db.insert("accountDeletionRequest", {
        ...values,
        phoneNumber: args.phoneNumber,
        requestedAt: now,
      });
    // Consume the challenge in the same transaction as the request write.
    await ctx.db.patch(challenge._id, { hashedOtp: "", expiresAt: 0 });
    return { request: { scope, status: "Requested" as const } };
  },
});
