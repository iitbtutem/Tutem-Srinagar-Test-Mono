import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { haversineDistance } from "@/lib/utils";

type Cords = {
  latitude: number;
  longitude: number;
};

const DISTANCE_THRESHOLD = 1; // meters

export function useDriverLiveLocation() {
  const [currentLocation, setCurrentLocation] = useState<Cords | null>(null);
  const lastLocation = useRef<Cords | null>(null);

  useEffect(() => {
    let watcher: Location.LocationSubscription;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

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

          console.log("diffence : ", distance)

          // Only update if moved at least 1 meter
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
  }, []);

  return currentLocation;
}