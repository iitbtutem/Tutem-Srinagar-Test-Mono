import { useEffect, useRef } from 'react';
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

  // 1. Manage Background Location Foreground Service
  useEffect(() => {
    if (!driverId || !userId) {
      stopLocationTracking();
      return;
    }

    const shouldTrack = (isAvailableForRide && isOnline) || hasActiveRide;

    if (shouldTrack) {
      console.log('[useLocationManager] Starting background location service...');
      startLocationTracking({ driverId, user_id: userId });
    } else {
      console.log('[useLocationManager] Stopping background location service...');
      stopLocationTracking();
    }
  }, [driverId, userId, isOnline, isAvailableForRide, hasActiveRide]);

  // 2. Native Pusher connection — initialise once per driver session.
  //    If native module is not linked (Expo Go / unbuilt dev client), falls back to HTTP POST.
  useEffect(() => {
    if (!driverId) return;

    let cancelled = false;

    const setup = async () => {
      if (!isNativePusherAvailable()) {
        console.log(
          '[useLocationManager] Native Pusher is not available (Expo Go / unbuilt dev client). ' +
            'Will publish location updates via HTTP trigger endpoint.'
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
          '[useLocationManager] Native Pusher setup failed. Falling back to HTTP trigger endpoint:',
          err
        );
        isNativePusherReadyRef.current = false;
      }
    };

    setup();

    return () => {
      cancelled = true;
      isNativePusherReadyRef.current = false;
      disconnectNativePusher().catch(() => {});
    };
  }, [driverId]);

  // 3. Foreground GPS Watching — publishes via native client event (or HTTP fallback)
  useEffect(() => {
    if (!driverId || !userId) return;

    let sub: Location.LocationSubscription | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isCancelled = false;

    const shouldPublish = (isAvailableForRide && isOnline) || hasActiveRide;

    const publishLocation = (coords: {
      latitude: number;
      longitude: number;
      heading: number | null;
      speed: number | null;
      timestamp: number;
    }) => {
      if (!shouldPublish) return;

      const payload = {
        driverId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        heading: coords.heading,
        speed: coords.speed,
        timestamp: coords.timestamp,
      };

      if (isNativePusherReadyRef.current) {
        triggerLocation(payload);
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
        };
        setLocation(coords);
        publishLocation({
          ...coords,
          heading: initialLoc.coords.heading,
          speed: initialLoc.coords.speed,
          timestamp: initialLoc.timestamp,
        });
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
          };
          setLocation(coords);
          publishLocation({
            ...coords,
            heading: loc.coords.heading,
            speed: loc.coords.speed,
            timestamp: loc.timestamp,
          });
        }
      );

      if (isCancelled) {
        sub.remove();
        sub = null;
        return;
      }

      // Heartbeat every 10s — keeps active-driver registry alive
      intervalId = setInterval(async () => {
        if (!shouldPublish) return;
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setLocation(coords);
          publishLocation({
            ...coords,
            heading: loc.coords.heading,
            speed: loc.coords.speed,
            timestamp: loc.timestamp,
          });
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
