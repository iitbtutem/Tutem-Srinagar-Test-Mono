import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  isDeletionScope,
  normalizeDeletionPhone,
} from "./helpers/accountDeletion";

function cors(request: Request): Record<string, string> | null {
  const origin = request.headers.get("Origin");
  const allowed = (process.env.ACCOUNT_DELETION_ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((value) => value.trim());
  if (origin && !allowed.includes("*") && !allowed.includes(origin))
    return null;
  return {
    "Access-Control-Allow-Origin": allowed.includes("*")
      ? "*"
      : (origin ?? allowed[0] ?? ""),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

export const preflight = httpAction(async (_ctx, request) => {
  const headers = cors(request);
  return new Response(null, {
    status: headers ? 204 : 403,
    headers: headers ?? {},
  });
});

export const handleRequest = httpAction(
  async (ctx, request): Promise<Response> => {
    const headers = cors(request);
    if (!headers) return new Response(null, { status: 403 });
    const json = (body: unknown, status = 200, retryAfterSeconds?: number) =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          ...headers,
          "Content-Type": "application/json",
          ...(retryAfterSeconds
            ? { "Retry-After": String(retryAfterSeconds) }
            : {}),
        },
      });
    try {
      if (!request.headers.get("content-type")?.includes("application/json")) {
        return json({ error: "Send a JSON request." }, 415);
      }
      const text = await request.text();
      if (text.length > 4096)
        return json({ error: "Request is too large." }, 413);
      let body: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error();
        body = parsed as Record<string, unknown>;
      } catch {
        return json({ error: "Invalid JSON request." }, 400);
      }
      const phoneNumber = normalizeDeletionPhone(body.phoneNumber);
      if (!phoneNumber)
        return json(
          { error: "Enter a valid 10-digit Indian mobile number." },
          400,
        );
      const path = new URL(request.url).pathname;
      if (path.endsWith("/status")) {
        const result = await ctx.runQuery(
          internal.routes.accountDeletion.getStatus,
          { phoneNumber },
        );
        return json({ request: result });
      }
      if (path.endsWith("/otp")) {
        if (body.extend !== undefined && typeof body.extend !== "boolean") {
          return json({ error: "Invalid request update." }, 400);
        }
        const result = await ctx.runAction(
          internal.actions.accountDeletion.sendOtp,
          { phoneNumber, ...(body.extend === true ? { extend: true } : {}) },
        );
        if (result.kind === "not_found")
          return json(
            {
              error:
                "No Rider or Driver account is registered with this mobile number.",
            },
            404,
          );
        if (result.kind === "limited")
          return json(
            {
              error: "Please wait before requesting another code.",
              retryAfterSeconds: result.retryAfterSeconds,
            },
            429,
            result.retryAfterSeconds,
          );
        if (result.kind === "unavailable")
          return json(
            { error: "We couldn't send a code. Please try again shortly." },
            503,
          );
        return json(result);
      }
      const scope = body.scope;
      if (!isDeletionScope(scope))
        return json({ error: "Choose Rider, Driver, or Both." }, 400);
      if (body.confirmed !== true)
        return json(
          { error: "Confirm that you want to request account deletion." },
          400,
        );
      if (
        typeof body.otp !== "string" ||
        !/^\d{6}$/.test(body.otp) ||
        typeof body.challengeId !== "string" ||
        !/^[\da-f-]{36}$/.test(body.challengeId)
      ) {
        return json({ error: "Enter the six-digit verification code." }, 400);
      }
      if (
        body.reason !== undefined &&
        (typeof body.reason !== "string" || body.reason.length > 500)
      ) {
        return json(
          { error: "Keep the reason to 500 characters or fewer." },
          400,
        );
      }
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      const result = await ctx.runAction(
        internal.actions.accountDeletion.submit,
        {
          phoneNumber,
          scope,
          challengeId: body.challengeId,
          otp: body.otp,
          ...(reason ? { reason } : {}),
        },
      );
      return result.error
        ? json({ error: result.error }, 400)
        : json({ request: result.request });
    } catch {
      // Do not leak gateway details, credentials, or backend errors to public callers.
      return json(
        { error: "Something went wrong. Please try again shortly." },
        500,
      );
    }
  },
);
