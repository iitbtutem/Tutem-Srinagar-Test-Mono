/**
 * apps/driver-app/lib/pusher.ts
 *
 * Driver-side Pusher helper.
 *
 * Unlike Ably, Pusher does NOT allow clients to publish directly.
 * Instead, we POST location data to our Next.js server's trigger endpoint,
 * which signs and forwards the event to Pusher using the server SDK.
 *
 * This module is used by:
 *   - useLocationManager (foreground publishing)
 *   - tasks.ts          (background publishing — same HTTP approach)
 *
 * ANDROID NOTE: The trigger URL is HTTP (not HTTPS) when pointing to a local
 * dev server. Ensure `usesCleartextTraffic: true` is set in app.config.js
 * under the `android` block, otherwise Android 9+ will silently block the
 * request and throw "TypeError: Network request failed".
 */

const TRIGGER_URL = process.env.EXPO_PUBLIC_PUSHER_TRIGGER_URL;

// Log the resolved URL once at module load so it's visible in Metro logs
if (__DEV__) {
  if (TRIGGER_URL) {
    console.log('[pusher.ts] Trigger URL:', TRIGGER_URL);
  } else {
    console.error(
      '[pusher.ts] ⚠️  EXPO_PUBLIC_PUSHER_TRIGGER_URL is not set in .env! ' +
      'Location updates will NOT be published.'
    );
  }
}

export interface LocationPayload {
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
}

/**
 * Publishes a driver location update to Pusher via the server trigger endpoint.
 * Fire-and-forget: errors are logged but not thrown.
 *
 * Uses AbortController to enforce a 5-second timeout so a slow/unreachable
 * server doesn't block the location-update loop.
 */
export async function publishDriverLocation(
  payload: LocationPayload
): Promise<void> {
  if (!TRIGGER_URL) {
    // Warning already logged at module load; skip silently here.
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(TRIGGER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        timestamp: payload.timestamp ?? Date.now(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[pusher.ts] Trigger endpoint returned ${response.status}:`,
        text
      );
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.error('[pusher.ts] Location publish timed out (>5s). ' +
        'Check that the Next.js server is running and reachable at:', TRIGGER_URL);
    } else {
      console.error(
        '[pusher.ts] Network error publishing location.\n' +
        '  URL:', TRIGGER_URL, '\n' +
        '  If using Android, ensure `usesCleartextTraffic: true` is set in app.config.js.\n' +
        '  Error:', err
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}
