import { atom } from 'jotai';
import * as Location from 'expo-location';
import { ConvexError } from 'convex/values';

export type Cords = {
  latitude: number;
  longitude: number;
};

export const locationAtom = atom<Cords | null>(null);

let permissionRequest: Promise<Location.LocationPermissionResponse> | null = null;

// Launch and registration can mount together. Share one native permission dialog.
export function getLocationPermission() {
  if (!permissionRequest) {
    permissionRequest = (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted' && permission.canAskAgain) {
        return Location.requestForegroundPermissionsAsync();
      }
      return permission;
    })().finally(() => {
      permissionRequest = null;
    });
  }
  return permissionRequest;
}

export async function getCurrentLocation() {
  const { status } = await getLocationPermission();

  if (status !== 'granted') {
    throw new ConvexError('Location permission denied');
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}
