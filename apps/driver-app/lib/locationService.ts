import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { AppState, Platform } from 'react-native';
import { BACKGROUND_LOCATION_TASK } from './tasks';

export type LocationMode = 'available' | 'on-ride';

const LOCATION_MODE_KEY = 'backgroundLocationMode';
const BACKGROUND_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  // Background execution can occur while an iPhone is locked. SecureStore's
  // default WHEN_UNLOCKED accessibility would make these values unreadable.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

// Serialise start/stop calls. Driver/query state can change several times during
// app hydration, and overlapping native registration calls can otherwise leave
// the task stopped even though the final state says it should be running.
let locationOperation: Promise<unknown> = Promise.resolve();

const enqueueLocationOperation = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = locationOperation.then(operation, operation);
  locationOperation = result.catch(() => undefined);
  return result;
};

/**
 * Start background location tracking.
 *
 * @param credentials  - driverId to persist for the headless background task
 * @param mode         - 'available' or 'on-ride' (used to set GPS interval accuracy)
 *
 * The background task always sends to /api/pusher/trigger — the server determines
 * whether to broadcast to Pusher or upsert to DB based on the driver's current state.
 *
 * SecureStore keys written:
 *   driverId           – driver's Convex document ID
 *   pusherTriggerUrl   – Convex /api/pusher/trigger (unified endpoint)
 */
export const startLocationTracking = async (driverId: string, mode: LocationMode = 'available') => {
  return enqueueLocationOperation(async () => {
    try {
      const taskManagerAvailable = await TaskManager.isAvailableAsync();
      if (!taskManagerAvailable) {
        console.error('[locationService] Background TaskManager is unavailable in this build.');
        return false;
      }

      if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
        console.error('[locationService] Background location task is not defined in global scope.');
        return false;
      }

      // Foreground permission (required). Avoid opening a permission prompt from
      // a background-triggered retry.
      let { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted' && AppState.currentState === 'active') {
        ({ status: foregroundStatus } = await Location.requestForegroundPermissionsAsync());
      }
      if (foregroundStatus !== 'granted') {
        console.warn('[locationService] ❌ Foreground location permission denied.');
        return false;
      }

      // Background permission (required for background task)
      // On Android the user must choose "Allow all the time" in Settings.
      let { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted' && AppState.currentState === 'active') {
        ({ status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync());
      }
      if (backgroundStatus !== 'granted') {
        console.warn(
          '[locationService] ⚠️ Background location permission NOT granted.\n' +
            'Location will NOT be sent when the app is minimized.\n' +
            'Go to Settings → Apps → tutem-driver → Permissions → Location → Allow all the time.'
        );
        return false;
      }

      // Android can run a foreground service without POST_NOTIFICATIONS, but the
      // notification may be hidden from the notification drawer on Android 13+.
      if (Platform.OS === 'android') {
        let { status: notificationStatus, canAskAgain } = await Notifications.getPermissionsAsync();
        if (notificationStatus !== 'granted' && canAskAgain && AppState.currentState === 'active') {
          ({ status: notificationStatus } = await Notifications.requestPermissionsAsync());
        }
        if (notificationStatus !== 'granted') {
          console.warn(
            '[locationService] Notification permission denied; Android may hide the tracking notification.'
          );
        }
      }

      // Persist the unified trigger URL + mode to SecureStore before starting the task.
      // process.env is NOT available in headless background tasks — URL is hardcoded here.
      const pusherTriggerUrl = process.env.EXPO_PUBLIC_PUSHER_TRIGGER_URL;

      if (!pusherTriggerUrl) {
        console.error('[locationService] ❌ pusherTriggerUrl is not set!');
        return false;
      }

      const backgroundLocationAvailable = await Location.isBackgroundLocationAvailableAsync();
      if (!backgroundLocationAvailable) {
        console.error(
          '[locationService] Background location provider is unavailable. Check device location services and the native build configuration.'
        );
        return false;
      }

      // Always write before starting the task so the first tick reads correct values.
      await SecureStore.setItemAsync(
        'pusherTriggerUrl',
        pusherTriggerUrl,
        BACKGROUND_STORE_OPTIONS
      );
      await SecureStore.setItemAsync('driverId', driverId, BACKGROUND_STORE_OPTIONS);

      console.log(`[locationService] SecureStore written: driverId=${driverId}`);

      const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      const registeredMode = await SecureStore.getItemAsync(LOCATION_MODE_KEY);

      if (hasStarted && registeredMode === mode) {
        console.log('[locationService] ✅ Background task already running in mode:', mode);
        return true;
      }

      // Android 12+ does not allow a location foreground service to be started
      // from the background. If a previous mode is already running, keep it alive
      // and apply the new interval the next time the app is foregrounded.
      if (AppState.currentState !== 'active') {
        if (hasStarted) {
          console.warn(
            '[locationService] App is backgrounded; keeping the existing location service until foreground.'
          );
          return true;
        }
        console.warn(
          '[locationService] Cannot start the location foreground service while the app is backgrounded.'
        );
        return false;
      }

      if (hasStarted) {
        // Registering the same Expo task updates its native options in place.
        // Do not stop and recreate the foreground service: Expo promotes a new
        // service through an asynchronous bind, which can race an immediate
        // screen lock/background transition on Android 14+.
        console.log(`[locationService] Updating background task: ${registeredMode} → ${mode}.`);
      }

      const isOnRide = mode === 'on-ride';

      console.log(
        `[locationService] Starting background location updates (mode: ${mode}, ` +
          `interval: ${isOnRide ? 10 : 30}s)...`
      );

      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: isOnRide ? Location.Accuracy.High : Location.Accuracy.Balanced,
        timeInterval: isOnRide ? 10000 : 30000,
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

      await SecureStore.setItemAsync(LOCATION_MODE_KEY, mode, BACKGROUND_STORE_OPTIONS);

      const registered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (!registered) {
        console.error(
          '[locationService] Native location task did not remain registered after start.'
        );
        return false;
      }

      console.log('[locationService] ✅ Started background location tracking successfully.');
      return true;
    } catch (error: any) {
      console.error(
        '[locationService] ❌ Error starting location tracking:',
        error?.message ?? error
      );
      return false;
    }
  });
};

export const isLocationTrackingRunning = async (): Promise<boolean> => {
  try {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
};

export const stopLocationTracking = async () => {
  return enqueueLocationOperation(async () => {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        await SecureStore.deleteItemAsync(LOCATION_MODE_KEY);
        console.log('[locationService] Stopped background location tracking.');
      }
    } catch (error) {
      console.error('[locationService] Error stopping location tracking:', error);
    }
  });
};
