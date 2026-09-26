import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

const KEY = 'latestDriverLocation';
export type LocationSnapshot = {
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  timestamp: number;
};

let latest: { driverId: string; location: LocationSnapshot } | null = null;
let persistence: Promise<unknown> = Promise.resolve();

export async function rememberDriverLocation(driverId: string, location: LocationSnapshot) {
  if (latest?.driverId === driverId && latest.location.timestamp > location.timestamp) return;
  latest = { driverId, location };
  persistence = persistence.catch(() => undefined).then(async () => {
    if (!latest) return;
    await SecureStore.setItemAsync(KEY, JSON.stringify(latest), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  });
  await persistence;
}

export async function getLatestDriverLocation(driverId: string): Promise<LocationSnapshot | null> {
  const stored = await SecureStore.getItemAsync(KEY);
  if (stored) {
    try {
      const cached = JSON.parse(stored) as NonNullable<typeof latest>;
      if (
        cached.driverId === driverId &&
        Number.isFinite(cached.location?.timestamp) &&
        (!latest || latest.driverId !== driverId || latest.location.timestamp < cached.location.timestamp)
      ) {
        latest = cached;
      }
    } catch {
      // A malformed cache must not prevent a fresh GPS fix.
    }
  }
  const native = await Location.getLastKnownPositionAsync().catch(() => null);
  const cached = latest?.driverId === driverId ? latest.location : null;
  if (native && (!cached || native.timestamp > cached.timestamp)) {
    return { ...native.coords, timestamp: native.timestamp };
  }
  return cached;
}

export async function clearDriverLocationSnapshot() {
  latest = null;
  await persistence.catch(() => undefined);
  await SecureStore.deleteItemAsync(KEY);
}
