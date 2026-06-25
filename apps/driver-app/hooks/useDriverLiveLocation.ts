import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { haversineDistance } from '@/lib/utils';
import { useAtom } from 'jotai';
import { locationAtom, Cords } from '@/lib/location';

const DISTANCE_THRESHOLD = 10; // meters

export function useDriverLiveLocation() {
  const [currentLocation, setCurrentLocation] = useAtom(locationAtom);
  const lastLocation = useRef<Cords | null>(null);

  useEffect(() => {
    let watcher: Location.LocationSubscription;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 1 },
        (location) => {
          const newLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };

          // First location
          if (!lastLocation.current) {
            lastLocation.current = newLocation;
            setCurrentLocation(newLocation);
            return;
          }

          // Check distance moved
          const distance = haversineDistance(
            lastLocation.current.latitude,
            lastLocation.current.longitude,
            newLocation.latitude,
            newLocation.longitude
          );

          // Only update if moved at least DISTANCE_THRESHOLD
          if (distance >= DISTANCE_THRESHOLD) {
            lastLocation.current = newLocation;
            setCurrentLocation(newLocation);
          }
        }
      );
    };

    startTracking();

    return () => {
      if (watcher) watcher.remove();
    };
  }, [setCurrentLocation]);

  return currentLocation;
}
