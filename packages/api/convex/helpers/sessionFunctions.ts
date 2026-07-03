import {
  customQuery,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { query, mutation } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";

export const authenticatedQuery = customQuery(query, {
  args: { sessionToken: v.string() },
  input: async (ctx, { sessionToken }) => {
    const session = await ctx.db
      .query("session")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", sessionToken))
      .first();

    if (!session || Date.now() > session.expiresAt) {
      throw new ConvexError("Invalid or expired session");
    }

    const user = await ctx.db.get(session.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    return { ctx: { session, user }, args: {} };
  },
});

export const authenticatedMutation = customMutation(mutation, {
  args: { sessionToken: v.string() },
  input: async (ctx, { sessionToken }) => {
    const session = await ctx.db
      .query("session")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", sessionToken))
      .first();

    if (!session || Date.now() > session.expiresAt) {
      throw new ConvexError("Invalid or expired session");
    }

    const user = await ctx.db.get(session.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    return { ctx: { session, user }, args: {} };
  },
});

export async function validateSession(ctx: ActionCtx, sessionToken: string) {
  const session = await ctx.runQuery(internal.routes.auth.getSessionByToken, {
    sessionToken,
  });

  if (!session) {
    throw new ConvexError("Invalid or expired session");
  }

  const user = await ctx.runQuery(internal.routes.auth.getUserByIdInternal, {
    userId: session.userId,
  });

  if (!user) {
    throw new ConvexError("User not found");
  }

  return { session, user };
}
