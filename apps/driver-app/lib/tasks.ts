import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

// Throttle for 'available' mode — only send to Convex DB once per 30s.
// On-ride mode sends on every GPS tick (rider tracking needs real-time updates).
let lastAvailableSentAt = 0;
const AVAILABLE_SEND_INTERVAL_MS = 30_000;

/**
 * Background location task.
 *
 * Runs in a headless JS context when the app is backgrounded.
 * Reads locationMode + URL from SecureStore (persisted by locationService.ts)
 * and routes accordingly:
 *
 *   mode = 'available'  →  POST to Convex /api/driver/location (upserts DB row)
 *                          Throttled to once per 30s.
 *
 *   mode = 'on-ride'    →  POST to Convex /api/pusher/trigger (broadcasts to Pusher)
 *                          Sent on every GPS tick for real-time rider tracking.
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[tasks.ts] ❌ Background Location Task Error:', error.message);
    return;
  }

  if (!data) {
    console.warn('[tasks.ts] Background task fired with no data.');
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) {
    console.warn('[tasks.ts] Background task: empty locations array.');
    return;
  }

  const location = locations[0];
  console.log(
    `[tasks.ts] 📍 Background tick: lat=${location.coords.latitude.toFixed(5)}, ` +
      `lng=${location.coords.longitude.toFixed(5)}`
  );

  try {
    const driverId = await SecureStore.getItemAsync('driverId');
    const locationMode = await SecureStore.getItemAsync('locationMode');
    const locationUpdateUrl = await SecureStore.getItemAsync('locationUpdateUrl');
    const pusherTriggerUrl = await SecureStore.getItemAsync('pusherTriggerUrl');

    console.log(`[tasks.ts] SecureStore: driverId=${driverId}, mode=${locationMode}`);

    if (!driverId) {
      console.warn('[tasks.ts] ⚠️ driverId missing in SecureStore. Cannot sync location.');
      return;
    }

    const basePayload = {
      driverId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: location.timestamp,
    };

    if (locationMode === 'on-ride') {
      // ── On-ride: POST to Convex /api/pusher/trigger → broadcasts to Pusher ────
      if (!pusherTriggerUrl) {
        console.error('[tasks.ts] ❌ pusherTriggerUrl missing in SecureStore.');
        return;
      }

      console.log(`[tasks.ts] 🚀 Posting on-ride location to: ${pusherTriggerUrl}`);

      const response = await fetch(pusherTriggerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...basePayload,
          heading: location.coords.heading,
          speed: location.coords.speed,
        }),
      });

      console.log('BG WORKING');
      if (!response.ok) {
        const text = await response.text();
        console.error(`[tasks.ts] ❌ Pusher trigger failed (${response.status}): ${text}`);
      } else {
        console.log('[tasks.ts] ✅ Published on-ride location to Pusher via HTTP.');
      }
    } else {
      // ── Available: POST to Convex /api/driver/location — throttled to 30s ────
      const now = Date.now();
      if (now - lastAvailableSentAt < AVAILABLE_SEND_INTERVAL_MS) {
        console.log('[tasks.ts] Throttled: skipping available location send (<30s).');
        return;
      }

      if (!locationUpdateUrl) {
        console.error('[tasks.ts] ❌ locationUpdateUrl missing in SecureStore.');
        return;
      }

      lastAvailableSentAt = now;

      const response = await fetch(locationUpdateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...basePayload, isAvailable: true }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`[tasks.ts] ❌ Location DB update failed (${response.status}): ${text}`);
      } else {
        console.log('[tasks.ts] ✅ Published available location to Convex DB.');
      }
    }
  } catch (err: any) {
    console.error('[tasks.ts] ❌ Background task exception:', err?.message ?? err);
  }
});
