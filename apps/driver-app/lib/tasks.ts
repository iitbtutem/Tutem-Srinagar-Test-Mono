import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

/**
 * Background location task.
 *
 * Runs in a headless JS context when the app is backgrounded.
 * Always sends location to /api/pusher/trigger — the server determines whether to:
 *   - Broadcast to Pusher (on-ride mode)
 *   - Upsert to Convex DB (available mode)
 *
 * The server checks the driver's current state (hasActiveRide) to make the routing decision.
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
    const pusherTriggerUrl = await SecureStore.getItemAsync('pusherTriggerUrl');

    if (!driverId) {
      console.warn('[tasks.ts] ⚠️ driverId missing in SecureStore. Cannot sync location.');
      return;
    }

    if (!pusherTriggerUrl) {
      console.error('[tasks.ts] ❌ pusherTriggerUrl missing in SecureStore.');
      return;
    }

    const payload = {
      driverId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      heading: location.coords.heading,
      speed: location.coords.speed,
      timestamp: location.timestamp,
    };

    console.log(`[tasks.ts] 🚀 Posting location to: ${pusherTriggerUrl}`);

    const response = await fetch(pusherTriggerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[tasks.ts] ❌ Location update failed (${response.status}): ${text}`);
    } else {
      console.log('[tasks.ts] ✅ Location sent successfully (server determines routing).');
    }
  } catch (err: any) {
    console.error('[tasks.ts] ❌ Background task exception:', err?.message ?? err);
  }
});
