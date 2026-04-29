import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

console.log(`[tasks.ts] ⏳ Defining TaskManager task: ${BACKGROUND_LOCATION_TASK}...`);

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[tasks.ts] Background Location Task Error:', error.message);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) return;

    const location = locations[0];

    try {
      const driverId = await SecureStore.getItemAsync('driverId');
      const authToken = await SecureStore.getItemAsync('authToken');

      if (!driverId || !authToken) {
        console.warn('[tasks.ts] Driver ID or Auth Token missing. Cannot sync location.');
        return;
      }

      const ABLY_API_KEY = await SecureStore.getItemAsync('ablyApiKey');
      if (!ABLY_API_KEY) {
        console.error('[tasks.ts] Ably API Key not found in SecureStore. Was it persisted before tracking started?');
        return;
      }

      const payload = {
        driverId,
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp,
      };

      // Do NOT use `new Ably.Rest()` here — the Ably SDK calls Node's
      // crypto.randomBytes internally, which is null in a headless JS
      // background task and throws:
      //   "TypeError: Cannot read property 'randomBytes' of null"
      //
      // Instead, call Ably's plain HTTP REST API directly. Same result,
      // no SDK, no native crypto dependency.
      const channelName = encodeURIComponent(`driver:location:${driverId}`);
      const response = await fetch(
        `https://rest.ably.io/channels/${channelName}/messages`,
        {
          method: 'POST',
          headers: {
            // Ably accepts HTTP Basic auth: base64(key_name:key_secret)
            Authorization: `Basic ${btoa(ABLY_API_KEY)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'locationUpdate', data: payload }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error('[tasks.ts] Ably REST publish failed:', response.status, text);
      } else {
        console.log('[tasks.ts] Published location to Ably via REST:', payload);
      }
    } catch (err) {
      console.error('[tasks.ts] Network or SecureStore error in background task:', err);
    }
  }
});
