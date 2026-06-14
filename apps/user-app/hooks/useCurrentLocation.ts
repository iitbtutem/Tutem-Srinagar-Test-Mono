// src/hooks/useLocation.ts

import { useAtom } from "jotai";
import { locationAtom } from "@/lib/location";
import { getCurrentLocation } from "@/lib/location";

export function useLocation() {
  const [ location, setLocation ] = useAtom(locationAtom);

  const refreshLocation = async () => {
    const currentLocation = await getCurrentLocation();
    setLocation(currentLocation);

    return currentLocation;
  };

  return {
    location,
    refreshLocation,
  };
}