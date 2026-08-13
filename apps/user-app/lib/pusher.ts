/**
 * apps/user-app/lib/pusher.ts
 *
 * Rider-side Pusher client using pusher-websocket-react-native.
 *
 * The native SDK maintains a persistent WebSocket connection using the
 * platform's native networking stack, reducing JS overhead and battery
 * usage compared to the pure-JS pusher-js/react-native adapter.
 *
 * The rider app only SUBSCRIBES — it never triggers events.
 * Listen for `client-locationUpdate` on the driver's private channel.
 *
 * Authentication is handled by the Next.js /api/pusher/auth endpoint
 * (one HTTP call per subscription, not per location update).
 */
import { NativeModules } from 'react-native';
import { Pusher, PusherChannel, PusherEvent } from '@pusher/pusher-websocket-react-native';

const APP_KEY = process.env.EXPO_PUBLIC_PUSHER_APP_KEY ?? '';
const CLUSTER = process.env.EXPO_PUBLIC_PUSHER_CLUSTER ?? '';
const AUTH_URL = process.env.EXPO_PUBLIC_PUSHER_AUTH_URL ?? '';

export function isNativePusherAvailable(): boolean {
  return Boolean(NativeModules.PusherWebsocketReactNative);
}

// ─── Singleton helper ──────────────────────────────────────────────────────────

let _initialized = false;

function getPusher(): Pusher {
  return Pusher.getInstance();
}

async function ensureConnected(): Promise<boolean> {
  if (!isNativePusherAvailable()) {
    console.warn(
      '[pusher.ts] Native module PusherWebsocketReactNative is not linked (Expo Go / unbuilt dev client).'
    );
    return false;
  }

  if (_initialized) return true;

  if (!APP_KEY || !CLUSTER) {
    console.error('[pusher.ts] EXPO_PUBLIC_PUSHER_APP_KEY or EXPO_PUBLIC_PUSHER_CLUSTER not set.');
    return false;
  }

  try {
    const pusher = getPusher();
    await pusher.init({
      apiKey: APP_KEY,
      cluster: CLUSTER,
      authEndpoint: AUTH_URL,
      onConnectionStateChange: (current, previous) => {
        console.log(`[pusher.ts] Connection: ${previous} → ${current}`);
      },
      onError: (message, code, error) => {
        console.error('[pusher.ts] Error:', message, code, error);
      },
    });

    await pusher.connect();
    _initialized = true;
    console.log('[pusher.ts] ✅ Native Pusher connected');
    return true;
  } catch (err) {
    console.error('[pusher.ts] Failed to initialize native Pusher:', err);
    return false;
  }
}

// ─── Channel helpers ──────────────────────────────────────────────────────────

const LOCATION_URL = AUTH_URL.replace('/api/pusher/auth', '/api/pusher/driver-location');

/**
 * Fetch a driver's latest recorded location directly from the backend.
 */
export async function fetchLatestDriverLocation(
  driverId: string
): Promise<DriverLocationPayload | null> {
  if (!LOCATION_URL) return null;
  try {
    const res = await fetch(`${LOCATION_URL}?driverId=${driverId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.location?.latitude && data.location?.longitude) {
      return data.location as DriverLocationPayload;
    }
  } catch (err) {
    console.error('[pusher.ts] Failed to fetch latest driver location:', err);
  }
  return null;
}

/**
 * Subscribe to a driver's location channel.
 * Pass an `onLocation` callback to receive real-time location updates.
 *
 * Automatically fetches latest location via HTTP immediately on call,
 * and maintains continuous location tracking even if native Pusher is unlinked.
 */
export async function subscribeDriverLocation(
  driverId: string,
  onLocation: (payload: DriverLocationPayload) => void
): Promise<PusherChannel | null> {
  // 1. Immediately fetch latest recorded location from server (0ms delay)
  fetchLatestDriverLocation(driverId).then((loc) => {
    if (loc) onLocation(loc);
  });

  // 2. Try subscribing via native Pusher SDK if available
  const connected = await ensureConnected();
  if (!connected) return null;

  const channelName = `private-driver-location-${driverId}`;

  try {
    const pusher = getPusher();
    const channel = await pusher.subscribe({
      channelName,
      onEvent: (event: PusherEvent) => {
        if (event.eventName === 'client-locationUpdate') {
          try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            onLocation(data as DriverLocationPayload);
          } catch (e) {
            console.error('[pusher.ts] Failed to parse location payload:', e);
          }
        }
      },
      onSubscriptionSucceeded: () => {
        console.log(`[pusher.ts] ✅ Subscribed to ${channelName}`);
      },
      onSubscriptionError: (message: string, e: any) => {
        console.error('[pusher.ts] Subscription error:', message, e);
      },
    });
    return channel;
  } catch (err) {
    console.error('[pusher.ts] subscribe() threw:', err);
    return null;
  }
}

/**
 * Unsubscribe from a driver's location channel.
 */
export async function unsubscribeDriverLocation(driverId: string): Promise<void> {
  if (!isNativePusherAvailable()) return;

  try {
    const pusher = getPusher();
    await pusher.unsubscribe({
      channelName: `private-driver-location-${driverId}`,
    });
    console.log(`[pusher.ts] Unsubscribed from private-driver-location-${driverId}`);
  } catch (err) {
    console.error('[pusher.ts] unsubscribe() threw:', err);
  }
}

/**
 * Disconnect the native Pusher client (e.g. on logout).
 */
export async function disconnectPusher(): Promise<void> {
  if (!isNativePusherAvailable()) return;

  try {
    const pusher = getPusher();
    await pusher.disconnect();
    _initialized = false;
  } catch {}
}

/**
 * Backward-compatible aliases for legacy callers (e.g. rideRequest.tsx)
 */
export async function getDriverChannel(
  driverId: string,
  onLocation?: (payload: DriverLocationPayload) => void
) {
  if (onLocation) {
    return await subscribeDriverLocation(driverId, onLocation);
  }
  return null;
}

export async function releaseDriverChannel(driverId: string): Promise<void> {
  await unsubscribeDriverLocation(driverId);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriverLocationPayload {
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
}
