/**
 * apps/user-app/lib/pusher.ts
 *
 * Rider-side Native Pusher client using @pusher/pusher-websocket-react-native.
 * Used for development builds (`npx expo run:android` / `npx expo run:ios`) and production.
 *
 * The rider app only SUBSCRIBES — it never triggers events.
 * Listens for `client-locationUpdate` on the driver's private channel.
 */
import { NativeModules } from 'react-native';
import { Pusher, PusherChannel, PusherEvent } from '@pusher/pusher-websocket-react-native';

const APP_KEY = process.env.EXPO_PUBLIC_PUSHER_APP_KEY ?? '';
const CLUSTER = process.env.EXPO_PUBLIC_PUSHER_CLUSTER ?? '';
const AUTH_URL = process.env.EXPO_PUBLIC_PUSHER_AUTH_URL ?? '';

export function isNativePusherAvailable(): boolean {
  return Boolean(NativeModules.PusherWebsocketReactNative);
}

let _initialized = false;

function getPusher(): Pusher {
  return Pusher.getInstance();
}

/**
 * Ensures the native Pusher client is initialized and connected.
 */
export async function ensureConnected(): Promise<boolean> {
  if (!isNativePusherAvailable()) {
    console.warn(
      '[pusher.ts] ⚠️ Native module PusherWebsocketReactNative is not linked.\n' +
        'Please run inside a development build: `npx expo run:android` or `npx expo run:ios`.'
    );
    return false;
  }

  if (_initialized) return true;

  if (!APP_KEY || !CLUSTER) {
    console.error(
      '[pusher.ts] ❌ EXPO_PUBLIC_PUSHER_APP_KEY or EXPO_PUBLIC_PUSHER_CLUSTER not set in .env.'
    );
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
    console.log('[pusher.ts] ✅ Native Pusher connected successfully');
    return true;
  } catch (err) {
    console.error('[pusher.ts] Failed to initialize native Pusher:', err);
    return false;
  }
}

/**
 * Subscribe to a driver's location channel.
 * Pass an `onLocation` callback to receive real-time location updates
 * broadcasted via the `client-locationUpdate` event.
 */
export async function subscribeDriverLocation(
  driverId: string,
  onLocation: (payload: DriverLocationPayload) => void
): Promise<PusherChannel | null> {
  const connected = await ensureConnected();
  if (!connected) return null;

  const channelName = `private-driver-location-${driverId}`;
  console.log(`[pusher.ts] Subscribing to native channel: ${channelName}`);

  try {
    const pusher = getPusher();
    const channel = await pusher.subscribe({
      channelName,
      onEvent: (event: PusherEvent) => {
        if (event.eventName === 'client-locationUpdate') {
          try {
            console.log('[pusher.ts] Received client-locationUpdate:', event.data);
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
        console.error(`[pusher.ts] ❌ Subscription error on ${channelName}:`, message, e);
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
    console.log('[pusher.ts] Disconnected native Pusher');
  } catch {}
}

/**
 * Backward-compatible aliases for legacy callers
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
