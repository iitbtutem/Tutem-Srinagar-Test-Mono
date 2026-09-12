import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import type { Cords } from '@/lib/location';

// Restart after Settings changes, and remove even asynchronously created watchers.
export function useRideLocation() {
  const [location, setLocation] = useState<Cords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSettings, setNeedsSettings] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt((value) => value + 1);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') retry();
    });
    return () => listener.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLocation(null);
    setError(null);
    setNeedsSettings(false);

    const start = async () => {
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (!permission.granted && permission.canAskAgain) {
          permission = await Location.requestForegroundPermissionsAsync();
        }
        if (cancelled) return;
        if (!permission.granted) {
          setNeedsSettings(!permission.canAskAgain);
          setError('Allow location access to calculate the fare for ending your ride.');
          return;
        }
        const enabled = await Location.hasServicesEnabledAsync();
        if (cancelled) return;
        if (!enabled) {
          setError('Turn on your phone’s location services, then tap Retry location.');
          return;
        }
        timer = setTimeout(() => {
          if (!cancelled) setError('Unable to get a GPS fix. Move to an open area and retry location.');
        }, 15_000);
        const watcher = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 0, timeInterval: 5_000 },
          ({ coords }) => {
            if (cancelled) return;
            clearTimeout(timer);
            setError(null);
            setLocation({ latitude: coords.latitude, longitude: coords.longitude });
          },
          () => {
            if (cancelled) return;
            clearTimeout(timer);
            setLocation(null);
            setError('Location is unavailable. Check location services and retry.');
          }
        );
        if (cancelled) watcher.remove();
        else subscription = watcher;
      } catch {
        if (!cancelled) {
          clearTimeout(timer);
          setError('Location is unavailable. Check location permission and retry.');
        }
      }
    };
    void start();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription?.remove();
    };
  }, [attempt]);

  return { location, error, needsSettings, retry };
}
