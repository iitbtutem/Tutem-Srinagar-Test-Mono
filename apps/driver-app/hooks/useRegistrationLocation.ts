import { useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { getLocationPermission, type Cords } from '@/lib/location';

// Registration needs a single fix, independently of online driver tracking.
export function useRegistrationLocation() {
  const [location, setLocation] = useState<Cords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [needsSettings, setNeedsSettings] = useState(false);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') setAttempt((value) => value + 1);
    });
    return () => listener.remove();
  }, []);

  useEffect(() => {
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    setError(null);
    setNeedsSettings(false);

    const start = async () => {
      try {
        const permission = await getLocationPermission();
        if (!active) return;
        if (permission.status !== 'granted') {
          setNeedsSettings(!permission.canAskAgain);
          setError('Allow location permission to find nearby organizations.');
          return;
        }

        if (!(await Location.hasServicesEnabledAsync())) {
          if (Platform.OS === 'android') await Location.enableNetworkProviderAsync();
          else throw new Error('Enable location services to find nearby organizations.');
        }
        if (!active) return;

        // Do not time out while the user is responding to a system dialog.
        timeout = setTimeout(() => {
          if (active) {
            active = false;
            setError('Unable to get your location. Enable location services and try again.');
          }
        }, 20_000);

        const cached = await Location.getLastKnownPositionAsync({
          maxAge: 60_000,
          requiredAccuracy: 100,
        }).catch(() => null);
        if (!active) return;
        const position =
          cached ??
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }));
        if (active) {
          setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        }
      } catch (cause: unknown) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Unable to get your location. Check location permissions and try again.'
          );
        }
      } finally {
        clearTimeout(timeout);
      }
    };
    void start();

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [attempt]);

  const retry = () => {
    setError(null);
    setLocation(null);
    setAttempt((value) => value + 1);
  };

  const requestLocation = () => {
    if (needsSettings) void Linking.openSettings();
    else retry();
  };

  return { location, error, retry: requestLocation, needsSettings };
}
