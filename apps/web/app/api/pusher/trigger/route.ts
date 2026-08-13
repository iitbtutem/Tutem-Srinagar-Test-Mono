import { NextRequest, NextResponse } from 'next/server';
import { getPusherServer, updateDriverLatestLocation, getActiveDriverIds } from '@/lib/pusher-server';

/**
 * POST /api/pusher/trigger
 *
 * Called by the driver background task to publish a location update
 * when the app is backgrounded (headless JS — no native module access).
 * Foreground location is now published by the driver app directly to
 * Pusher via client events (pusherNative.ts) — no server needed.
 *
 * Uses the `client-locationUpdate` event name so background and foreground
 * events are indistinguishable to subscribers.
 *
 * Body: { driverId, latitude, longitude, heading?, speed?, timestamp? }
 */
export async function POST(req: NextRequest) {
  let driverId = 'unknown';
  try {
    const body = await req.json();
    ({ driverId } = body);
    const { latitude, longitude, heading, speed, timestamp } = body;

    if (!driverId || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: driverId, latitude, longitude' },
        { status: 400 }
      );
    }

    console.log(`[trigger] 📍 Location received for driver ${driverId}: ${latitude}, ${longitude}`);

    const locationPayload = {
      driverId,
      latitude,
      longitude,
      heading: heading ?? null,
      speed: speed ?? null,
      timestamp: timestamp ?? Date.now(),
    };

    // Update active-driver registry immediately (in-memory, always fast)
    updateDriverLatestLocation(locationPayload);

    // Respond to driver immediately — don't block on external Pusher API call
    const response = NextResponse.json({ success: true });

    // Fire-and-forget Pusher triggers with hard timeout
    fireAndForgetTrigger(driverId, locationPayload).catch(() => {
      // Errors already logged inside
    });

    return response;
  } catch (error) {
    console.error(`[trigger] ❌ Error processing request for driver ${driverId}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Attempts to forward the location event to Pusher.
 * Races against a 6s timeout so a blocked Pusher connection
 * doesn't hold up the response or consume server resources.
 */
async function fireAndForgetTrigger(
  driverId: string,
  locationPayload: object
): Promise<void> {
  const timeout = (ms: number) =>
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Pusher trigger timed out after ${ms}ms`)), ms)
    );

  try {
    const pusher = getPusherServer();
    const channelName = `private-driver-location-${driverId}`;

    console.log(`[trigger] 🔄 Sending to Pusher channel: ${channelName}`);

    // Race: Pusher trigger vs 6s timeout
    await Promise.race([
      (async () => {
        await pusher.trigger(channelName, 'client-locationUpdate', locationPayload);
        console.log(`[trigger] ✅ client-locationUpdate sent to ${channelName}`);

        // Broadcast updated active-driver list
        const activeDriverIds = getActiveDriverIds();
        await pusher.trigger('private-active-drivers', 'list-updated', {
          activeDriverIds,
          count: activeDriverIds.length,
        });
        console.log(`[trigger] ✅ Active drivers list broadcast: ${activeDriverIds.length} drivers`);
      })(),
      timeout(6000),
    ]);
  } catch (err: any) {
    if (err?.message?.includes('timed out')) {
      console.error(
        '[trigger] ⏱️  Pusher API timed out (6s). Check:\n' +
        '  1. Server internet access to api-ap2.pusher.com:443\n' +
        '  2. Pusher credentials in apps/web/.env.local\n' +
        '  3. Pusher dashboard: https://dashboard.pusher.com'
      );
    } else {
      console.error('[trigger] ❌ Pusher trigger failed:', err?.message ?? err);
    }
  }
}
