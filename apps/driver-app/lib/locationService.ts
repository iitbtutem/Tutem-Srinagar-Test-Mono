import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { BACKGROUND_LOCATION_TASK } from './tasks';

export const startLocationTracking = async (credentials?: { driverId: string; user_id: string }) => {
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.warn('Foreground location permission denied.');
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn('Background location permission denied.');
      return false;
    }

    const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
    if (notificationStatus !== 'granted') {
      console.warn('Notification permission denied. Background service may fail on Android 13+.');
    }

    // Persist the Pusher trigger URL to SecureStore so the headless background
    // task can access it. process.env is NOT available in background tasks.
    const triggerUrl = process.env.EXPO_PUBLIC_PUSHER_TRIGGER_URL;
    if (!triggerUrl) {
      console.error('[locationService] EXPO_PUBLIC_PUSHER_TRIGGER_URL is not set in .env!');
      return false;
    }
    await SecureStore.setItemAsync('pusherTriggerUrl', triggerUrl);

    if (credentials) {
      await SecureStore.setItemAsync('driverId', credentials.driverId);
      await SecureStore.setItemAsync('user_id', credentials.user_id);
    }

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (hasStarted) {
      console.log('[locationService] Location tracking is already running.');
      return true;
    }

    console.log(`[locationService] Starting Location Updates for task: ${BACKGROUND_LOCATION_TASK}...`);
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10000,
      distanceInterval: 10,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: "You're Online",
        notificationBody: 'Location tracking is active for your rides.',
        notificationColor: '#10b981',
        killServiceOnDestroy: false,
      },
    });

    console.log('[locationService] ✅ Started background location tracking successfully.');
    return true;
  } catch (error) {
    console.error('Error starting location tracking:', error);
    return false;
  }
};

export const isLocationTrackingRunning = async (): Promise<boolean> => {
  try {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
};

export const stopLocationTracking = async () => {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('Stopped background location tracking.');
    }
  } catch (error) {
    console.error('Error stopping location tracking:', error);
  }
};
