import { useEffect } from 'react';
import * as Location from 'expo-location';
import { useSetAtom } from 'jotai';
import { locationAtom } from '@/lib/location';
import { startLocationTracking, stopLocationTracking } from '@/lib/locationService';
import { getDriverChannel, getGlobalChannel } from '@/lib/ably';

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
  isLicenseVerified = false,
  hasActiveRide = false,
}: LocationManagerOptions) {
  const setLocation = useSetAtom(locationAtom);

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

  // 2. Manage Foreground GPS Watching & Ably Streaming/Presence
  useEffect(() => {
    if (!driverId || !userId) return;

    let sub: Location.LocationSubscription | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let globalChannel: ReturnType<typeof getGlobalChannel> | null = null;
    let isCancelled = false;

    const shouldPublish = (isAvailableForRide && isOnline) || hasActiveRide;

    const updatePresence = async (lat: number, lng: number) => {
      if (isAvailableForRide && isOnline && !hasActiveRide && globalChannel) {
        try {
          await globalChannel.presence.update({
            driverId,
            latitude: lat,
            longitude: lng,
            vehicleClass:
              isLicenseVerified === true || isLicenseVerified === 'Verified'
                ? 'verified'
                : 'Not Verified',
            lastUpdated: Date.now(),
          });
        } catch (e) {
          console.error('[useLocationManager] Ably presence update error:', e);
        }
      } else if (globalChannel) {
        globalChannel.presence.leave().catch(() => {});
      }
    };

    const publishLocation = (coords: {
      latitude: number;
      longitude: number;
      heading: number | null;
      speed: number | null;
      timestamp: number;
    }) => {
      if (shouldPublish) {
        const channel = getDriverChannel(driverId, userId);
        if (channel) {
          channel
            .publish('location', coords)
            .catch((err: unknown) => console.error('[useLocationManager] Ably publish error:', err));
        }
      }
    };

    const startForegroundTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || isCancelled) return;

      globalChannel = getGlobalChannel(undefined, userId);

      // Initial Position Fetch
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

      // Watch Position
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => {
          const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };

          setLocation(coords);
          updatePresence(coords.latitude, coords.longitude);

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

      // Heartbeat interval every 10s for continuous streaming
      intervalId = setInterval(async () => {
        if (shouldPublish) {
          try {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            const coords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };

            setLocation(coords);
            updatePresence(coords.latitude, coords.longitude);

            publishLocation({
              ...coords,
              heading: loc.coords.heading,
              speed: loc.coords.speed,
              timestamp: loc.timestamp,
            });
          } catch (e) {
            console.error('[useLocationManager] Heartbeat location fetch error:', e);
          }
        }
      }, 10000);

      // Initial presence entry
      if (isAvailableForRide && isOnline && !hasActiveRide) {
        globalChannel?.presence
          .enter({
            driverId,
          })
          .catch(() => {});
      }
    };

    startForegroundTracking();

    return () => {
      isCancelled = true;
      sub?.remove();
      if (intervalId !== null) clearInterval(intervalId);
      globalChannel?.presence.leave().catch(() => {});
    };
  }, [driverId, userId, isOnline, isAvailableForRide, isLicenseVerified, hasActiveRide, setLocation]);
}
