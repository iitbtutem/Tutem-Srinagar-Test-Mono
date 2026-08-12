import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { AppState } from 'react-native';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

function base64Encode(str: string): string {
  if (typeof btoa === 'function') {
    return btoa(str);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (
    let block = 0, charCode: number, i = 0, map = chars;
    str.charAt(i | 0) || ((map = '='), i % 1);
    output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
  ) {
    charCode = str.charCodeAt((i += 3 / 4));
    if (charCode > 0xff) {
      throw new Error(
        "'base64Encode' failed: The string to be encoded contains characters outside of the Latin1 range."
      );
    }
    block = (block << 8) | charCode;
  }
  return output;
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[tasks.ts] Background Location Task Error:', error.message);
    return;
  }

  // Skip when app is open/foreground
  if (AppState.currentState === 'active') {
    console.log('[tasks.ts] App is foregrounded. Skipping location sync.');
    return;
  }

  if (data) {
    const { locations } = data as {
      locations: Location.LocationObject[];
    };

    if (!locations || locations.length === 0) return;

    const location = locations[0];

    try {
      const driverId = await SecureStore.getItemAsync('driverId');
      const user_id = await SecureStore.getItemAsync('user_id');

      if (!driverId || !user_id) {
        console.warn(
          '[tasks.ts] Driver ID or User ID missing. Cannot sync location.'
        );
        return;
      }

      const ABLY_API_KEY = await SecureStore.getItemAsync('ablyApiKey');

      if (!ABLY_API_KEY) {
        console.error('[tasks.ts] Ably API Key missing.');
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

      const channelName = encodeURIComponent(
        `driver:location:${driverId}`
      );

      const response = await fetch(
        `https://rest.ably.io/channels/${channelName}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${base64Encode(ABLY_API_KEY)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'locationUpdate',
            data: payload,
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text();

        console.error(
          '[tasks.ts] Ably REST publish failed:',
          response.status,
          text
        );
      } else {
        console.log(
          '[tasks.ts] Published background location:',
          payload
        );
      }
    } catch (err) {
      console.error('[tasks.ts] Background task error:', err);
    }
  }
});