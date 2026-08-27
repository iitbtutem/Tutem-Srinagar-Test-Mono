import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ---------------------------------------------------------------------------
// 1. Pusher Channel Authentication  GET /api/pusher/auth
//
// Called automatically by the Pusher SDK when a client subscribes to a
// private- or presence- channel.
//
// For presence channels the native SDK sends any extra `auth.params` (e.g.
// driverId, latitude, longitude) as additional form fields alongside
// socket_id and channel_name. We forward them to authorizeChannel so they
// can be embedded in presence user_info.
// ---------------------------------------------------------------------------
http.route({
  path: "/api/pusher/auth",
  method: "OPTIONS",
  handler: httpAction(
    async () => new Response(null, { status: 204, headers: corsHeaders }),
  ),
});

http.route({
  path: "/api/pusher/auth",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const contentType = request.headers.get("content-type") ?? "";
      let socketId = "";
      let channelName = "";
      let driverId: string | undefined;
      let latitude: number | undefined;
      let longitude: number | undefined;

      if (contentType.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams(await request.text());
        socketId = params.get("socket_id") ?? "";
        channelName = params.get("channel_name") ?? "";
        driverId =
          params.get("driverId") ?? params.get("driver_id") ?? undefined;
        const lat = params.get("latitude") ?? params.get("lat");
        const lng = params.get("longitude") ?? params.get("lng");
        if (lat) latitude = Number(lat);
        if (lng) longitude = Number(lng);
      } else {
        const body = await request.json();
        socketId = body.socket_id ?? body.socketId ?? "";
        channelName = body.channel_name ?? body.channelName ?? "";
        driverId = body.driverId ?? body.driver_id;
        if (body.latitude != null) latitude = Number(body.latitude);
        if (body.longitude != null) longitude = Number(body.longitude);
        if (body.lat != null && latitude === undefined)
          latitude = Number(body.lat);
        if (body.lng != null && longitude === undefined)
          longitude = Number(body.lng);
      }

      if (!socketId || !channelName) {
        return new Response(
          JSON.stringify({ error: "Missing socket_id or channel_name" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const authData = await ctx.runAction(
        api.actions.pusher.authorizeChannel,
        {
          socketId,
          channelName,
          ...(driverId !== undefined ? { driverId } : {}),
          ...(latitude !== undefined ? { latitude } : {}),
          ...(longitude !== undefined ? { longitude } : {}),
        },
      );

      return new Response(JSON.stringify(authData), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("[POST /api/pusher/auth] Error:", error);
      return new Response(
        JSON.stringify({ error: error?.message || "Internal server error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }),
});

// ---------------------------------------------------------------------------
// 2. Driver Location Trigger  POST /api/pusher/trigger
//
// Called by:
//   • driver-app/lib/pusher.ts  — foreground fallback (when native Pusher unavailable)
//   • driver-app/lib/tasks.ts   — background location task (always)
//
// Body: { driverId, latitude, longitude, heading?, speed?, timestamp? }
//
// Unified routing (server-side):
//   • If driver has active ride → broadcast to Pusher (real-time rider tracking)
//   • If driver is available → upsert to Convex DB (nearby driver discovery)
//
// The server checks the driver's current state to determine routing automatically.
// ---------------------------------------------------------------------------
http.route({
  path: "/api/pusher/trigger",
  method: "OPTIONS",
  handler: httpAction(
    async () => new Response(null, { status: 204, headers: corsHeaders }),
  ),
});

http.route({
  path: "/api/pusher/trigger",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const {
        driverId,
        latitude,
        longitude,
        heading,
        speed,
        timestamp,
        isAvailable,
      } = body;

      if (!driverId || latitude === undefined || longitude === undefined) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields: driverId, latitude, longitude",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const result = await ctx.runAction(
        api.actions.pusher.triggerDriverLocation,
        {
          driverId: driverId as Id<"driver">,
          latitude: Number(latitude),
          longitude: Number(longitude),
          heading: heading != null ? Number(heading) : null,
          speed: speed != null ? Number(speed) : null,
          // Always use server receive-time so the tracking page shows accurate
          // "last seen" regardless of GPS clock drift or device clock skew.
          timestamp: Date.now(),
          isAvailable: isAvailable !== false, // default true
        },
      );

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("[POST /api/pusher/trigger] Error:", error);
      return new Response(
        JSON.stringify({ error: error?.message || "Internal server error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }),
});

// ---------------------------------------------------------------------------
// 3. Driver Location Query  GET /api/pusher/driver-location?driverId=...
//
// Called by:
//   • user-app/lib/pusher.ts — polling fallback every 3s (Expo Go / unbuilt dev client)
//   • user-app/lib/pusher.ts — immediate seed on screen mount
//
// Returns the latest location stored in the server-side cache by the trigger
// endpoint. Returns { success: true, location: null } if no location cached yet.
// ---------------------------------------------------------------------------
http.route({
  path: "/api/pusher/driver-location",
  method: "OPTIONS",
  handler: httpAction(
    async () => new Response(null, { status: 204, headers: corsHeaders }),
  ),
});

http.route({
  path: "/api/pusher/driver-location",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const driverId = url.searchParams.get("driverId");

    if (!driverId) {
      return new Response(
        JSON.stringify({ error: "Missing driverId query parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    try {
      const result = await ctx.runAction(api.actions.pusher.getDriverLocation, {
        driverId: driverId as Id<"driver">,
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("[GET /api/pusher/driver-location] Error:", error);
      return new Response(
        JSON.stringify({ error: error?.message || "Internal server error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }),
});

export default http;
