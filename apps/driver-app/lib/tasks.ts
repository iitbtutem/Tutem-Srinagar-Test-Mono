import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { AppState } from 'react-native';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

/**
 * Background location task.
 *
 * Runs in a headless JS context when the app is backgrounded.
 * Reads the Pusher trigger URL from SecureStore (persisted by locationService.ts)
 * and POSTs the driver's location to the Next.js server trigger endpoint,
 * which then signs and forwards the event to Pusher.
 *
 * We use our own server endpoint rather than calling Pusher REST directly
 * because:
 *   1. Pusher REST auth requires HMAC-SHA256 which is complex in a headless context.
 *   2. The server already has all Pusher credentials securely.
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[tasks.ts] Background Location Task Error:', error.message);
    return;
  }

  // Skip when the app is in the foreground — foreground hook handles publishing
  if (AppState.currentState === 'active') {
    console.log('[tasks.ts] App is foregrounded. Skipping background location sync.');
    return;
  }

  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  const location = locations[0];

  try {
    const driverId = await SecureStore.getItemAsync('driverId');
    const pusherTriggerUrl = await SecureStore.getItemAsync('pusherTriggerUrl');

    if (!driverId) {
      console.warn('[tasks.ts] Driver ID missing. Cannot sync location.');
      return;
    }

    if (!pusherTriggerUrl) {
      console.error('[tasks.ts] Pusher trigger URL missing. Did locationService.ts run?');
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

    // POST to our Next.js trigger endpoint → server forwards to Pusher
    const response = await fetch(pusherTriggerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[tasks.ts] Trigger failed (${response.status}):`,
        text
      );
    } else {
      console.log('[tasks.ts] ✅ Published background location:', payload);
    }
  } catch (err) {
    console.error('[tasks.ts] Background task error:', err);
  }
});