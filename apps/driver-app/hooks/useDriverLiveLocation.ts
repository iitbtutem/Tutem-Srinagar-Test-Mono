import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { locationAtom, getCurrentLocation } from '@/lib/location';

export function useDriverLiveLocation() {
  const [currentLocation, setCurrentLocation] = useAtom(locationAtom);

  useEffect(() => {
    if (!currentLocation) {
      getCurrentLocation()
        .then((loc) => setCurrentLocation(loc))
        .catch(() => {});
    }
  }, [currentLocation, setCurrentLocation]);

  return currentLocation;
}
