"use node";

import { createHash, randomInt, randomUUID } from "node:crypto";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { deletionScope, type DeletionScope } from "../helpers/accountDeletion";

type PublicRequest = { scope: DeletionScope; status: "Requested" | "Deleted" };
type SendResult =
  | {
      kind: "existing";
      request: PublicRequest;
      remainingScope: DeletionScope | null;
    }
  | {
      kind: "otp";
      challengeId: string;
      availableScope: DeletionScope;
      expiresInSeconds: number;
      retryAfterSeconds: number;
    }
  | { kind: "limited"; retryAfterSeconds: number }
  | { kind: "not_found" }
  | { kind: "unavailable" };

function hashOtp(challengeId: string, otp: string) {
  return createHash("sha256").update(`${challengeId}:${otp}`).digest("hex");
}

export const sendOtp = internalAction({
  args: { phoneNumber: v.string(), extend: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<SendResult> => {
    const state = await ctx.runQuery(
      internal.routes.accountDeletion.getIntakeState,
      { phoneNumber: args.phoneNumber },
    );
    if (state.request && (!args.extend || !state.remainingScope))
      return {
        kind: "existing",
        request: state.request,
        remainingScope: state.remainingScope,
      };
    if (!state.availableScope) return { kind: "not_found" };
    const smsUrl = process.env.SMS_URL;
    const smsLicense = process.env.SMS_LICENSE;
    if (!smsUrl || !smsLicense) return { kind: "unavailable" };
    const challengeId = randomUUID();
    const otp = randomInt(100000, 1000000).toString();
    const result = await ctx.runMutation(
      internal.routes.accountDeletion.prepareOtp,
      {
        ...args,
        challengeId,
        hashedOtp: hashOtp(challengeId, otp),
      },
    );
    if (result.kind !== "otp") return result;
    try {
      const response = await fetch(smsUrl, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          "auth-client": "LSCL",
          "auth-licence": smsLicense,
        },
        body: JSON.stringify({
          phone_number: `+91${args.phoneNumber}`,
          message_type: "registration_otp",
          otp,
        }),
      });
      if (!response.ok) throw new Error("SMS delivery failed");
      return result;
    } catch {
      await ctx.runMutation(internal.routes.accountDeletion.invalidateOtp, {
        phoneNumber: args.phoneNumber,
        challengeId,
      });
      return { kind: "unavailable" };
    }
  },
});

export const submit = internalAction({
  args: {
    phoneNumber: v.string(),
    scope: deletionScope,
    challengeId: v.string(),
    otp: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { otp, ...args },
  ): Promise<{ request?: PublicRequest; error?: string }> => {
    return ctx.runMutation(internal.routes.accountDeletion.submit, {
      ...args,
      hashedOtp: hashOtp(args.challengeId, otp),
    });
  },
});
