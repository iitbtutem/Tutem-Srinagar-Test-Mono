import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { BACKGROUND_LOCATION_TASK } from './tasks';

export type LocationMode = 'available' | 'on-ride';

/**
 * Start background location tracking.
 *
 * @param credentials  - driverId + user_id to persist for the headless background task
 * @param mode         - 'available' → POST to Convex DB endpoint (getNearbyDrivers pool)
 *                       'on-ride'   → POST to Convex Pusher trigger (rider tracking)
 *
 * SecureStore keys written:
 *   driverId           – driver's Convex document ID
 *   user_id            – user's Convex document ID
 *   locationMode       – 'available' | 'on-ride'
 *   locationUpdateUrl  – Convex /api/driver/location  (used in 'available' mode)
 *   pusherTriggerUrl   – Convex /api/pusher/trigger   (used in 'on-ride' mode)
 */
export const startLocationTracking = async (
  credentials?: { driverId: string; user_id: string },
  mode: LocationMode = 'available'
) => {
  try {
    // ── Foreground permission (required) ──────────────────────────────────────
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.warn('[locationService] ❌ Foreground location permission denied.');
      return false;
    }

    // ── Background permission (required for background task) ──────────────────
    // On Android the user must choose "Allow all the time" in Settings.
    // If only "While using the app" is granted, we log a warning but still
    // allow foreground-only tracking (watchPositionAsync will work when active).
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn(
        '[locationService] ⚠️ Background location permission NOT granted.\n' +
          'Location will NOT be sent when the app is minimized.\n' +
          'Go to Settings → Apps → tutem-driver → Permissions → Location → Allow all the time.'
      );
      // Don't return false — we still want the foreground service to start
      // so watchPositionAsync works when the app is active.
    }

    // ── Notification permission (required for Android foreground service) ─────
    const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
    if (notificationStatus !== 'granted') {
      console.warn(
        '[locationService] ⚠️ Notification permission denied. ' +
          'Background service will fail on Android 13+ without it.'
      );
    }

    // ── Persist URLs and mode to SecureStore ──────────────────────────────────
    // process.env is NOT available in headless background tasks.
    const locationUpdateUrl = process.env.EXPO_PUBLIC_LOCATION_UPDATE_URL;
    const pusherTriggerUrl = process.env.EXPO_PUBLIC_PUSHER_TRIGGER_URL;

    if (!locationUpdateUrl) {
      console.error('[locationService] ❌ EXPO_PUBLIC_LOCATION_UPDATE_URL is not set in .env!');
      return false;
    }
    if (!pusherTriggerUrl) {
      console.error('[locationService] ❌ EXPO_PUBLIC_PUSHER_TRIGGER_URL is not set in .env!');
      return false;
    }

    // Always write before starting the task so the first tick reads correct values.
    await SecureStore.setItemAsync('locationMode', mode);
    await SecureStore.setItemAsync('locationUpdateUrl', locationUpdateUrl);
    await SecureStore.setItemAsync('pusherTriggerUrl', pusherTriggerUrl);
    if (credentials) {
      await SecureStore.setItemAsync('driverId', credentials.driverId);
      await SecureStore.setItemAsync('user_id', credentials.user_id);
    }

    console.log(`[locationService] SecureStore written: mode=${mode}, driverId=${credentials?.driverId}`);

    // If background permission was denied, skip starting the background task.
    // Foreground watchPositionAsync (in useLocationManager) will handle active tracking.
    if (backgroundStatus !== 'granted') {
      console.warn('[locationService] Skipping startLocationUpdatesAsync (no background permission).');
      return true;
    }

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);

    // On-ride needs real-time accuracy — restart the task with tighter intervals
    // if it was previously running in 'available' mode.
    if (hasStarted && mode === 'on-ride') {
      console.log('[locationService] Restarting background task in on-ride mode for tighter updates.');
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } else if (hasStarted) {
      // Available mode already running — mode updated in SecureStore above, no restart needed.
      console.log('[locationService] ✅ Background task already running, mode updated to:', mode);
      return true;
    }

    const isOnRide = mode === 'on-ride';

    console.log(
      `[locationService] Starting background location updates (mode: ${mode}, ` +
        `interval: ${isOnRide ? 4 : 15}s)...`
    );

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: isOnRide ? Location.Accuracy.High : Location.Accuracy.Balanced,
      timeInterval: isOnRide ? 4000 : 15000,
      // distanceInterval:0 = fire on time interval alone regardless of movement.
      // This is critical for on-ride so location is sent even when the driver is stationary.
      distanceInterval: 0,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: isOnRide ? 'Ride in progress' : "You're Online",
        notificationBody: isOnRide
          ? 'Sharing your location with rider.'
          : 'Location tracking is active for your rides.',
        notificationColor: isOnRide ? '#3b82f6' : '#10b981',
        killServiceOnDestroy: false,
      },
    });

    console.log('[locationService] ✅ Started background location tracking successfully.');
    return true;
  } catch (error: any) {
    console.error('[locationService] ❌ Error starting location tracking:', error?.message ?? error);
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
      console.log('[locationService] Stopped background location tracking.');
    }
  } catch (error) {
    console.error('[locationService] Error stopping location tracking:', error);
  }
};
