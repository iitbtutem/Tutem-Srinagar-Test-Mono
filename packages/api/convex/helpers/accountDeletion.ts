import { v } from "convex/values";

export const deletionScope = v.union(
  v.literal("Rider"),
  v.literal("Driver"),
  v.literal("Both"),
);
export const deletionStatus = v.union(
  v.literal("Requested"),
  v.literal("Deleted"),
);
export type DeletionScope = "Rider" | "Driver" | "Both";
export const OTP_LIFETIME_MS = 5 * 60 * 1000;
export const OTP_COOLDOWN_MS = 60 * 1000;
export const OTP_WINDOW_MS = 60 * 60 * 1000;
export const OTP_SEND_LIMIT = 5;
export const OTP_ATTEMPT_LIMIT = 5;

export function normalizeDeletionPhone(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 32) return null;
  const phone = input
    .trim()
    .replace(/[ ()-]/g, "")
    .replace(/^\+91/, "");
  return /^\d{10}$/.test(phone) ? phone : null;
}

export function isDeletionScope(input: unknown): input is DeletionScope {
  return input === "Rider" || input === "Driver" || input === "Both";
}

export function coversScope(existing: DeletionScope, selected: DeletionScope) {
  return existing === "Both" || existing === selected;
}

export function mergeScope(
  existing: DeletionScope,
  selected: DeletionScope,
): DeletionScope {
  return existing === selected ? existing : "Both";
}
