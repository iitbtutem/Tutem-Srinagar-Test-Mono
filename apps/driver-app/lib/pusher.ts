/**
 * apps/driver-app/lib/pusher.ts
 *
 * Native Pusher client for the driver app using @pusher/pusher-websocket-react-native.
 *
 * Uses Pusher CLIENT EVENTS (`client-locationUpdate`) to broadcast driver location
 * directly to Pusher without any HTTP / Next.js server roundtrips.
 *
 * Requires "Client Events" to be enabled in Pusher Dashboard:
 *   Dashboard → App Settings → Enable Client Events → Save
 */
import { NativeModules } from 'react-native';
import { Pusher, PusherChannel, PusherEvent } from '@pusher/pusher-websocket-react-native';

const APP_KEY = process.env.EXPO_PUBLIC_PUSHER_APP_KEY ?? '';
const CLUSTER = process.env.EXPO_PUBLIC_PUSHER_CLUSTER ?? '';
const AUTH_URL = process.env.EXPO_PUBLIC_PUSHER_AUTH_URL ?? '';

// ─── Native Availability Check ───────────────────────────────────────────────

/**
 * Returns true if the native C++/Java/Swift Pusher module is linked in the binary.
 */
export function isNativePusherAvailable(): boolean {
  return Boolean(NativeModules.PusherWebsocketReactNative);
}

// ─── Singleton helper ──────────────────────────────────────────────────────────

let _initialized = false;
let _channel: PusherChannel | null = null;
let _subscribedDriverId: string | null = null;

function getPusher(): Pusher {
  return Pusher.getInstance();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Initialise and connect the native Pusher client.
 */
export async function initNativePusher(): Promise<boolean> {
  if (!isNativePusherAvailable()) {
    console.warn(
      '[pusher.ts] ⚠️ Native module PusherWebsocketReactNative is not linked.\n' +
        'Please run inside a development build: `npx expo run:android` or `npx expo run:ios`.'
    );
    return false;
  }

  if (_initialized) return true;

  if (!APP_KEY || !CLUSTER) {
    console.error('[pusher.ts] ❌ EXPO_PUBLIC_PUSHER_APP_KEY or EXPO_PUBLIC_PUSHER_CLUSTER not set in .env.');
    return false;
  }

  if (!AUTH_URL) {
    console.error('[pusher.ts] ❌ EXPO_PUBLIC_PUSHER_AUTH_URL not set in .env.');
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

let _isSubscribed = false;

// ─── Channel management ───────────────────────────────────────────────────────

/**
 * Subscribe to the driver's private location channel.
 */
export async function subscribeDriverChannel(driverId: string): Promise<boolean> {
  if (!isNativePusherAvailable()) return false;

  const pusher = getPusher();

  // Already subscribed to this driver's channel
  if (_subscribedDriverId === driverId && _channel && _isSubscribed) return true;

  // Unsubscribe from previous channel if different
  if (_subscribedDriverId && _channel) {
    try {
      await pusher.unsubscribe({
        channelName: `private-driver-location-${_subscribedDriverId}`,
      });
    } catch {}
    _channel = null;
    _subscribedDriverId = null;
    _isSubscribed = false;
  }

  const channelName = `private-driver-location-${driverId}`;
  try {
    _channel = await pusher.subscribe({
      channelName,
      onEvent: (_event: PusherEvent) => {},
      onSubscriptionError: (message: string, e: any) => {
        console.error('[pusher.ts] ❌ Subscription error on', channelName, ':', message, e);
        _isSubscribed = false;
      },
      onSubscriptionSucceeded: () => {
        console.log(`[pusher.ts] ✅ Subscribed to ${channelName}`);
        _isSubscribed = true;
      },
    });

    _subscribedDriverId = driverId;
    return true;
  } catch (err) {
    console.error('[pusher.ts] Failed to subscribe to channel:', err);
    return false;
  }
}

// ─── Publishing ───────────────────────────────────────────────────────────────

export interface NativeLocationPayload {
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
}

/**
 * Trigger a location update DIRECTLY on Pusher via client events.
 */
export async function triggerLocation(payload: NativeLocationPayload): Promise<boolean> {
  if (!isNativePusherAvailable()) {
    return false;
  }

  const channelName = `private-driver-location-${payload.driverId}`;

  try {
    const payloadData = {
      ...payload,
      timestamp: payload.timestamp ?? Date.now(),
    };

    const pusher = getPusher();
    await pusher.trigger({
      channelName,
      eventName: 'client-locationUpdate',
      data: JSON.stringify(payloadData),
    });
    return true;
  } catch (err: any) {
    console.error(
      '[pusher.ts] Failed to trigger client event:',
      err?.message || err?.description || JSON.stringify(err) || err
    );
    return false;
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Unsubscribe and disconnect.
 */
export async function disconnectNativePusher(): Promise<void> {
  if (!isNativePusherAvailable()) return;

  try {
    const pusher = getPusher();

    if (_subscribedDriverId) {
      try {
        await pusher.unsubscribe({
          channelName: `private-driver-location-${_subscribedDriverId}`,
        });
      } catch {}
      _channel = null;
      _subscribedDriverId = null;
      _isSubscribed = false;
    }

    await pusher.disconnect();
  } catch {}

  _initialized = false;
  _isSubscribed = false;
  console.log('[pusher.ts] Disconnected native Pusher');
}
