"use node";

import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { createHash, randomInt } from "crypto";
import { OTP_ATTEMPTS, OTP_SIZE } from "../CONSTANTS";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function generateOtp(): string {
  const min = Math.pow(10, OTP_SIZE - 1);
  const max = Math.pow(10, OTP_SIZE);
  return randomInt(min, max).toString();
}

export const sendOtp = action({
  args: {
    phoneNumber: v.string(), // full international format e.g. "+919876543210"
  },
  handler: async (ctx, { phoneNumber }) => {
    const otp = generateOtp();
    const hashedOtp = sha256(otp);
    const smsLicense = process.env.SMS_LICENSE;
    const smsUrl = process.env.SMS_URL;
    if (smsLicense === undefined || smsUrl === undefined)
      throw new ConvexError(`L ${smsLicense}, U ${smsUrl}`);

    await ctx.runMutation(internal.routes.auth.upsertOtpSession, {
      phoneNumber,
      hashedOtp,
    });

    const smsData = {
      phone_number: phoneNumber,
      message_type: "registration_otp",
      otp,
    };

    const smsHeaders = {
      accept: "application/json",
      "auth-client": "LSCL",
      "auth-licence": smsLicense,
      "Content-Type": "application/json",
    };

    const response = await fetch(smsUrl, {
      method: "POST",
      headers: smsHeaders,
      body: JSON.stringify(smsData),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new ConvexError(
        `SMS gateway error ${response.status}: ${errorText}`,
      );
    }

    return { success: true };
  },
});

export const verifyOtp = action({
  args: {
    phoneNumber: v.string(),
    otp: v.string(),
  },
  handler: async (ctx, { phoneNumber, otp }) => {
    const candidateHash = sha256(otp);
    const session = await ctx.runQuery(internal.routes.auth.getOtpSession, {
      phoneNumber,
    });

    if (!session) {
      throw new ConvexError("Please request a new OTP.");
    }

    if (Date.now() > session.expiresAt) {
      await ctx.runMutation(internal.routes.auth.deleteOtpSession, {
        phoneNumber,
      });
      throw new ConvexError("OTP has expired. Please request a new one.");
    }
    if (candidateHash !== session.hashedOtp) {
      await ctx.runMutation(internal.routes.auth.incrementAttempts, {
        phoneNumber,
      });

      const attemptsLeft = OTP_ATTEMPTS - (session.attempts + 1);
      if (attemptsLeft <= 0) {
        throw new ConvexError(
          "Too many incorrect attempts. Please request a new OTP.",
        );
      }
      throw new ConvexError(
        `Incorrect OTP. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining.`,
      );
    }

    await ctx.runMutation(internal.routes.auth.deleteOtpSession, {
      phoneNumber,
    });

    return { success: true, userId: phoneNumber };
  },
});
