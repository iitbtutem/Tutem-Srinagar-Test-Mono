import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { haversineDistance } from "@/lib/utils";

type Cords = {
  latitude: number;
  longitude: number;
};

const DISTANCE_THRESHOLD = 1; // meters
const INTERVAL = 1000 * 2; // 2 seconds

export function useRiderLiveLocation() {
  const [currentLocation, setCurrentLocation] = useState<Cords | null>(null);

  const lastSentLocation = useRef<Cords | null>(null);

  useEffect(() => {
    let interval: any;

    const getAndUpdateLocation = async () => {
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const newCoords: Cords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        // Initial location
        if (!lastSentLocation.current) {
          lastSentLocation.current = newCoords;
          setCurrentLocation(newCoords);

          // socket/API update here
          console.log("Initial location:", newCoords);

          return;
        }

        const distance = haversineDistance(
          lastSentLocation.current.latitude,
          lastSentLocation.current.longitude,
          newCoords.latitude,
          newCoords.longitude
        );

        // Update only if moved >= 1 meter
        if (distance >= DISTANCE_THRESHOLD) {
          lastSentLocation.current = newCoords;
          setCurrentLocation(newCoords);

          // socket/API update here
          console.log("Rider moved:", distance, "meters");
          console.log("Updated location:", newCoords);
        }
      } catch (error) {
        console.log("Location error:", error);
      }
    };

    const startTracking = async () => {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") return;

      // Fetch initial location immediately
      await getAndUpdateLocation();

      // Then track every 10 seconds
      interval = setInterval(getAndUpdateLocation, INTERVAL);
    };

    startTracking();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  return currentLocation;
}