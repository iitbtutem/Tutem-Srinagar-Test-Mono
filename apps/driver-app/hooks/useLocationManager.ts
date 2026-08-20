import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
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

// Throttle: available-mode DB upserts are capped to once per 30s.
// Riders discovering drivers don't need sub-second freshness.
const AVAILABLE_SEND_INTERVAL_MS = 30_000;

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
      startLocationTracking({ driverId, user_id: userId }, currentMode);
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
  }, [driverId]);

  // 3. Foreground GPS Watching
  useEffect(() => {
    if (!driverId || !userId) return;

    let sub: Location.LocationSubscription | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isCancelled = false;
    let lastDbSentAt = 0; // throttle tracker for 'available' mode

    const shouldPublish = (isAvailableForRide && isOnline) || hasActiveRide;

    /**
     * Publish driver location.
     *
     * - available mode: call Convex SDK mutation directly (upserts DB row, throttled 30s).
     *   Uses the already-open Convex WebSocket — zero extra network connections.
     *
     * - on-ride mode: send directly to Pusher via native client event (zero server hop).
     *   Falls back to POST /api/pusher/trigger only if native Pusher is not available.
     */
    const publishLocation = async (coords: {
      latitude: number;
      longitude: number;
      timestamp: number;
    }) => {
      if (!shouldPublish) return;

      if (!hasActiveRide && isAvailableForRide && isOnline) {
        // ── Available mode: Convex SDK mutation (no HTTP) ─────────────────────────
        const now = Date.now();
        if (now - lastDbSentAt < AVAILABLE_SEND_INTERVAL_MS) return; // throttled
        lastDbSentAt = now;

        if (!driverId) return;
        upsertLocation({
          driverId: driverId as any,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }).catch((err) => {
          console.error('[useLocationManager] Convex upsert failed:', err);
        });

        console.log('[useLocationManager] 📍 Upserted location via Convex SDK (available mode)');
      } else if (hasActiveRide) {
        // ── On-ride mode: send directly to Pusher (native) → HTTP fallback ──────
        const payload = {
          driverId: driverId!,
          latitude: coords.latitude,
          longitude: coords.longitude,
          timestamp: coords.timestamp,
        };

        // Try native Pusher client event first (zero server hop).
        // If it returns false (connection dropped / minimized), cascade to HTTP.
        let sentViaNative = false;
        if (isNativePusherReadyRef.current) {
          sentViaNative = await triggerLocation(payload);
          if (!sentViaNative) {
            console.warn('[useLocationManager] Native Pusher trigger failed — falling back to HTTP.');
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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || isCancelled) return;

      // Initial position
      try {
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (isCancelled) return;

        const coords = {
          latitude: initialLoc.coords.latitude,
          longitude: initialLoc.coords.longitude,
          timestamp: initialLoc.timestamp,
        };
        setLocation({ latitude: coords.latitude, longitude: coords.longitude });
        publishLocation(coords);
      } catch (err) {
        console.error('[useLocationManager] Initial location fetch error:', err);
      }

      if (isCancelled) return;

      // Continuous watch — fires on every >5 m move
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => {
          const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
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

      // Heartbeat every 10s — ensures available-mode DB row stays fresh even without movement
      intervalId = setInterval(async () => {
        if (!shouldPublish) return;
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            timestamp: loc.timestamp,
          };
          setLocation({ latitude: coords.latitude, longitude: coords.longitude });
          publishLocation(coords);
        } catch (e) {
          console.error('[useLocationManager] Heartbeat location fetch error:', e);
        }
      }, 10000);
    };

    startForegroundTracking();

    return () => {
      isCancelled = true;
      sub?.remove();
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [driverId, userId, isOnline, isAvailableForRide, hasActiveRide, setLocation]);
}

