import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { useSetAtom } from 'jotai';
import { locationAtom } from '@/lib/location';
import { startLocationTracking, stopLocationTracking } from '@/lib/locationService';
import {
  isNativePusherAvailable,
  initNativePusher,
  subscribeDriverChannel,
  triggerLocation,
  disconnectNativePusher,
} from '@/lib/pusher';
import { useAuthenticatedMutation } from '@/hooks/customApi';
import { api } from '@tutem/api';

// Pusher HTTP fallback URL — used only in Expo Go / unbuilt dev client
// when the native Pusher module is not linked (on-ride mode, foreground).
const PUSHER_TRIGGER_URL = process.env.EXPO_PUBLIC_PUSHER_TRIGGER_URL ?? '';

/**
 * Calculate optimal send interval based on driver's speed.
 *
 * For available mode (driver waiting for rides):
 * - Speed < 1 m/s (~3.6 km/h, stationary): 60 seconds
 * - Speed < 5.56 m/s (20 km/h): 45 seconds
 * - Speed < 11.11 m/s (40 km/h): 30 seconds
 * - Speed >= 11.11 m/s (40+ km/h): 20 seconds
 *
 * For on-ride mode (active ride):
 * - Speed < 10 m/s (~36 km/h): 20 seconds
 * - Speed < 12.5 m/s (~45 km/h): 15 seconds
 * - Speed >= 12.5 m/s: 10 seconds
 */
const getOptimalIntervalAvailable = (speed: number | null | undefined): number => {
  if (!speed || speed < 1) return 60_000; // Stationary: 60s
  if (speed < 5.56) return 45_000; // < 20 km/h: 45s
  if (speed < 11.11) return 30_000; // < 40 km/h: 30s
  return 20_000; // >= 40 km/h: 20s
};

const getOptimalIntervalOnRide = (speed: number | null | undefined): number => {
  if (!speed || speed < 10) return 20_000; // Slow or stationary: 20s
  if (speed < 12.5) return 15_000; // Medium speed: 15s
  return 10_000; // Fast: 10s
};

interface LocationManagerOptions {
  driverId?: string;
  userId?: string;
  isOnline?: boolean;
  isAvailableForRide?: boolean;
  isLicenseVerified?: boolean | string;
  hasActiveRide?: boolean;
}

export function useLocationManager({
  driverId,
  userId,
  isOnline = false,
  isAvailableForRide = false,
  isLicenseVerified: _isLicenseVerified = false,
  hasActiveRide = false,
}: LocationManagerOptions) {
  const setLocation = useSetAtom(locationAtom);
  const isNativePusherReadyRef = useRef<boolean>(false);

  // Convex SDK mutations — called directly over the WebSocket, no HTTP fetch needed
  const upsertLocation = useAuthenticatedMutation(
    api.routes.driverLocation.upsertAvailableDriverLocationSDK
  );
  const deleteLocation = useAuthenticatedMutation(
    api.routes.driverLocation.deleteAvailableDriverLocationSDK
  );

  // 1. Manage Background Location Foreground Service
  //    Also updates SecureStore with current mode so background task routes correctly.
  useEffect(() => {
    if (!driverId || !userId) {
      stopLocationTracking();
      return;
    }

    const shouldTrack = (isAvailableForRide && isOnline) || hasActiveRide;

    if (shouldTrack) {
      const currentMode = hasActiveRide ? 'on-ride' : 'available';
      console.log('[useLocationManager] Starting background location service, mode:', currentMode);
      startLocationTracking(driverId, currentMode);
    } else {
      console.log('[useLocationManager] Stopping background location service...');
      stopLocationTracking();
    }
  }, [driverId, userId, isOnline, isAvailableForRide, hasActiveRide]);

  // 2. Native Pusher connection — initialised once per driver session.
  //    Only needed for on-ride mode (direct client events to Pusher).
  //    Available mode doesn't use Pusher at all.
  //    Also reconnects when the app returns to foreground (Android can drop WS in background).
  useEffect(() => {
    if (!driverId) return;

    // Only initialize Pusher for on-ride drivers
    if (!hasActiveRide) {
      // Not on ride — disconnect Pusher if connected
      disconnectNativePusher().catch(() => {});
      isNativePusherReadyRef.current = false;
      return;
    }

    let cancelled = false;

    const setup = async () => {
      if (!isNativePusherAvailable()) {
        console.log(
          '[useLocationManager] Native Pusher not available (Expo Go / unbuilt dev client). ' +
            'On-ride location will use HTTP fallback to Convex /api/pusher/trigger.'
        );
        isNativePusherReadyRef.current = false;
        return;
      }

      try {
        const initOk = await initNativePusher();
        if (cancelled || !initOk) return;
        const subOk = await subscribeDriverChannel(driverId);
        if (cancelled || !subOk) return;

        isNativePusherReadyRef.current = true;
        console.log('[useLocationManager] ✅ Native Pusher ready for client events');
      } catch (err) {
        console.warn(
          '[useLocationManager] Native Pusher setup failed. On-ride will use HTTP fallback:',
          err
        );
        isNativePusherReadyRef.current = false;
      }
    };

    setup();

    // Re-connect whenever the app returns to the foreground.
    // Android can silently drop the WebSocket while minimized.
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && !cancelled) {
        console.log('[useLocationManager] App foregrounded — re-checking Pusher connection...');
        setup();
      }
    });

    return () => {
      cancelled = true;
      isNativePusherReadyRef.current = false;
      appStateSub.remove();
      disconnectNativePusher().catch(() => {});
    };
  }, [driverId, hasActiveRide]);

  // 3. Foreground GPS Watching
  //
  // On-ride Pusher client events use adaptive throttling based on speed.
  // Pusher enforces a hard limit of ~10 client events/sec per connection.

  useEffect(() => {
    if (!driverId || !userId) return;

    let sub: Location.LocationSubscription | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;
    let isCancelled = false;
    let lastDbSentAt = 0; // throttle for available-mode DB upserts
    let lastOnRideSentAt = 0; // throttle for on-ride Pusher publishes
    // Concurrency guard — prevents multiple concurrent startForegroundTracking calls.
    // Without this, rapid AppState 'active' events or fast effect re-runs stack
    // multiple watchPositionAsync subscriptions that all fire concurrently, causing
    // duplicate publishes and Pusher rate-limit rejections.
    let isStarting = false;

    const shouldPublish = (isAvailableForRide && isOnline) || hasActiveRide;

    /**
     * Publish driver location.
     *
     * - available mode: call Convex SDK mutation directly (upserts DB row, adaptive throttle).
     *   Uses the already-open Convex WebSocket — zero extra network connections.
     *   Server-side routing happens in the SDK mutation handler.
     *
     * - on-ride mode: send directly to Pusher via native client event (adaptive throttle).
     *   Falls back to POST /api/pusher/trigger only if native Pusher is not available.
     *   Server-side routing happens in the HTTP endpoint handler.
     */
    const publishLocation = async (coords: {
      latitude: number;
      longitude: number;
      speed?: number | null;
      heading?: number | null;
      timestamp: number;
    }) => {
      if (!shouldPublish) return;

      if (!hasActiveRide && isAvailableForRide && isOnline) {
        // ── Available mode: Convex SDK mutation with adaptive throttle ─────────────
        const now = Date.now();
        const adaptiveInterval = getOptimalIntervalAvailable(coords.speed);
        if (now - lastDbSentAt < adaptiveInterval) return; // adaptive throttle
        lastDbSentAt = now;

        if (!driverId) return;
        upsertLocation({
          driverId: driverId as any,
          latitude: coords.latitude,
          longitude: coords.longitude,
          speed: coords.speed ?? undefined,
          heading: coords.heading ?? undefined,
        }).catch((err) => {
          console.error('[useLocationManager] Convex upsert failed:', err);
        });

        console.log(
          `[useLocationManager] 📍 Upserted location via Convex SDK (available mode, interval: ${adaptiveInterval}ms)`
        );
      } else if (hasActiveRide) {
        // ── On-ride mode — adaptive throttle based on speed ────────────────────────
        const now = Date.now();
        const adaptiveInterval = getOptimalIntervalOnRide(coords.speed);
        if (now - lastOnRideSentAt < adaptiveInterval) return;
        lastOnRideSentAt = now;

        const payload = {
          driverId: driverId!,
          latitude: coords.latitude,
          longitude: coords.longitude,
          heading: coords.heading,
          speed: coords.speed,
          timestamp: coords.timestamp,
        };

        // Try native Pusher client event first (zero server hop).
        // If it returns false (connection dropped / minimized), cascade to HTTP.
        let sentViaNative = false;
        if (isNativePusherReadyRef.current) {
          sentViaNative = await triggerLocation(payload);
          if (!sentViaNative) {
            console.warn(
              '[useLocationManager] Native Pusher trigger failed — falling back to HTTP.'
            );
          }
        }

        if (!sentViaNative && PUSHER_TRIGGER_URL) {
          fetch(PUSHER_TRIGGER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch((err) => {
            console.error('[useLocationManager] HTTP fallback also failed:', err);
          });
        }
      }
    };

    const startForegroundTracking = async () => {
      // Skip if already starting — prevents stacked watchers from rapid AppState events
      if (isStarting) {
        console.log('[useLocationManager] startForegroundTracking already in progress — skipping.');
        return;
      }
      isStarting = true;

      try {
        // Tear down any existing watcher before starting fresh
        sub?.remove();
        sub = null;
        if (intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || isCancelled) return;

        // Immediate first fix
        try {
          const initialLoc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          if (isCancelled) return;

          const coords = {
            latitude: initialLoc.coords.latitude,
            longitude: initialLoc.coords.longitude,
            speed: initialLoc.coords.speed,
            heading: initialLoc.coords.heading,
            timestamp: initialLoc.timestamp,
          };
          setLocation({ latitude: coords.latitude, longitude: coords.longitude });
          publishLocation(coords);
        } catch (err) {
          console.error('[useLocationManager] Initial location fetch error:', err);
        }

        if (isCancelled) return;

        // Continuous watch — fires on every >50 m move
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 50 },
          (loc) => {
            const coords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              speed: loc.coords.speed,
              heading: loc.coords.heading,
              timestamp: loc.timestamp,
            };
            setLocation({ latitude: coords.latitude, longitude: coords.longitude });
            publishLocation(coords);
          }
        );

        if (isCancelled) {
          sub.remove();
          sub = null;
          return;
        }

        // Heartbeat every 30 s — keeps available-mode DB row alive when stationary
        intervalId = setInterval(async () => {
          if (!shouldPublish || isCancelled) return;
          try {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            const coords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              speed: loc.coords.speed,
              heading: loc.coords.heading,
              timestamp: loc.timestamp,
            };
            setLocation({ latitude: coords.latitude, longitude: coords.longitude });
            publishLocation(coords);
          } catch (e) {
            console.error('[useLocationManager] Heartbeat location fetch error:', e);
          }
        }, 30_000);
      } finally {
        isStarting = false;
      }
    };

    startForegroundTracking();

    // Re-start the foreground watcher whenever the app returns to foreground.
    // On Android, watchPositionAsync can silently stall while the app is minimised.
    // The isStarting guard inside startForegroundTracking ensures only one call
    // runs at a time even if the OS emits rapid active/background transitions.
    appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && !isCancelled) {
        console.log('[useLocationManager] App foregrounded — restarting foreground GPS watcher...');
        startForegroundTracking();
      }
    });

    return () => {
      isCancelled = true;
      sub?.remove();
      if (intervalId !== null) clearInterval(intervalId);
      appStateSub?.remove();
    };
  }, [driverId, userId, isOnline, isAvailableForRide, hasActiveRide, setLocation, upsertLocation]);
}
