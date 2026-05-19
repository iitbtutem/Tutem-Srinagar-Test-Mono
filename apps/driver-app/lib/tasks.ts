import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { AppState } from 'react-native';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

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
      const authToken = await SecureStore.getItemAsync('authToken');

      if (!driverId || !authToken) {
        console.warn(
          '[tasks.ts] Driver ID or Auth Token missing. Cannot sync location.'
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
            Authorization: `Basic ${btoa(ABLY_API_KEY)}`,
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