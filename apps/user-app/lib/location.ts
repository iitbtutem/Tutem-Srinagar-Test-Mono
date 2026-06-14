import { atom } from "jotai";
import * as Location from "expo-location";

export type Cords = {
  latitude: number;
  longitude: number;
};

export const locationAtom = atom<Cords>({ latitude: 28.6139, longitude: 77.209 });

export async function getCurrentLocation() {
  const { status } =
    await Location.requestForegroundPermissionsAsync();

  if (status !== "granted") {
    throw new Error("Location permission denied");
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}