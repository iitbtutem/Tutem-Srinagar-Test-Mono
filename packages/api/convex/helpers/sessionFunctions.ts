import {
  customQuery,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { query, mutation, type DatabaseReader } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { PERMISSIONS } from "../CONSTANTS";

async function resolveSession(
  db: DatabaseReader,
  sessionToken: string,
  requiredPermission?: (typeof PERMISSIONS)[number],
) {
  const session = await db
    .query("session")
    .withIndex("by_sessionToken", (q) => q.eq("sessionToken", sessionToken))
    .first();

  if (!session || Date.now() > session.expiresAt) {
    throw new ConvexError("Invalid or expired session");
  }

  const user = await db.get(session.userId);
  if (!user) {
    throw new ConvexError("User not found");
  }

  if (requiredPermission) {
    const perm = await db
      .query("userPermission")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("permission"), requiredPermission))
      .first();

    if (!perm) {
      throw new ConvexError(
        `Unauthorized: ${requiredPermission} permission required`,
      );
    }
  }

  return { session, user };
}

export const authenticatedQuery = customQuery(query, {
  args: { sessionToken: v.string() },
  input: async (ctx, { sessionToken }) => {
    const { session, user } = await resolveSession(ctx.db, sessionToken);
    return { ctx: { session, user }, args: {} };
  },
});

export const authenticatedMutation = customMutation(mutation, {
  args: { sessionToken: v.string() },
  input: async (ctx, { sessionToken }) => {
    const { session, user } = await resolveSession(ctx.db, sessionToken);
    return { ctx: { session, user }, args: {} };
  },
});

export const queryWithPermission = (
  requiredPermission: (typeof PERMISSIONS)[number],
) =>
  customQuery(query, {
    args: { sessionToken: v.string() },
    input: async (ctx, { sessionToken }) => {
      const { session, user } = await resolveSession(
        ctx.db,
        sessionToken,
        requiredPermission,
      );
      return { ctx: { session, user }, args: {} };
    },
  });

export const mutationWithPermission = (
  requiredPermission: (typeof PERMISSIONS)[number],
) =>
  customMutation(mutation, {
    args: { sessionToken: v.string() },
    input: async (ctx, { sessionToken }) => {
      const { session, user } = await resolveSession(
        ctx.db,
        sessionToken,
        requiredPermission,
      );
      return { ctx: { session, user }, args: {} };
    },
  });

// Specific helper queries and mutations for clean usage
export const driverQuery = queryWithPermission("Driver");
export const driverMutation = mutationWithPermission("Driver");

export const riderQuery = queryWithPermission("Rider");
export const riderMutation = mutationWithPermission("Rider");

export const adminQuery = queryWithPermission("Admin");
export const adminMutation = mutationWithPermission("Admin");

export async function validateSession(
  ctx: ActionCtx,
  sessionToken: string,
  requiredPermission?: (typeof PERMISSIONS)[number],
) {
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

  if (
    requiredPermission &&
    !user.permissions.some((p) => p === requiredPermission)
  ) {
    throw new ConvexError("Unauthorized");
  }

  return { session, user };
}
