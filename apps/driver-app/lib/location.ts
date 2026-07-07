import { atom } from 'jotai';
import * as Location from 'expo-location';
import { ConvexError } from 'convex/values';

export type Cords = {
  latitude: number;
  longitude: number;
};

export const locationAtom = atom<Cords | null>(null);

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();

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
