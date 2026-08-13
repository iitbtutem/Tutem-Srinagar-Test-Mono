/**
 * apps/driver-app/lib/pusherNative.ts
 *
 * Native Pusher client for the driver app using pusher-websocket-react-native.
 *
 * Key benefit: Pusher CLIENT EVENTS let the driver trigger location updates
 * directly to Pusher without any Next.js server roundtrip, eliminating HTTP
 * overhead on every GPS tick.
 *
 * Requires "Client Events" to be enabled in the Pusher dashboard:
 *   Dashboard → App Settings → Enable Client Events → Save
 *
 * Fallback: If running in Expo Go or an unbuilt dev-client where the native module
 * is not linked, `isNativePusherAvailable()` returns false, allowing the app to
 * fall back gracefully to the HTTP trigger endpoint.
 */
import { NativeModules } from 'react-native';
import { Pusher, PusherChannel, PusherEvent } from '@pusher/pusher-websocket-react-native';

const APP_KEY = process.env.EXPO_PUBLIC_PUSHER_APP_KEY ?? '';
const CLUSTER = process.env.EXPO_PUBLIC_PUSHER_CLUSTER ?? '';
const AUTH_URL = process.env.EXPO_PUBLIC_PUSHER_AUTH_URL ?? '';

// ─── Native Availability Check ───────────────────────────────────────────────

/**
 * Returns true if the native C++/Java/Swift Pusher module is linked in the binary.
 * Returns false in Expo Go or when running an unbuilt development client.
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
 * Returns true on success, false if native module is unavailable or misconfigured.
 */
export async function initNativePusher(): Promise<boolean> {
  if (!isNativePusherAvailable()) {
    console.warn(
      '[pusherNative] Native module PusherWebsocketReactNative is not linked (Expo Go / unbuilt dev client). ' +
        'Falling back to HTTP trigger endpoint.'
    );
    return false;
  }

  if (_initialized) return true;

  if (!APP_KEY || !CLUSTER) {
    console.error(
      '[pusherNative] ⚠️ EXPO_PUBLIC_PUSHER_APP_KEY or EXPO_PUBLIC_PUSHER_CLUSTER not set.'
    );
    return false;
  }

  if (!AUTH_URL) {
    console.error(
      '[pusherNative] ⚠️ EXPO_PUBLIC_PUSHER_AUTH_URL not set. Private channel subscription will fail.'
    );
  }

  try {
    const pusher = getPusher();
    await pusher.init({
      apiKey: APP_KEY,
      cluster: CLUSTER,
      authEndpoint: AUTH_URL,
      onConnectionStateChange: (current, previous) => {
        console.log(`[pusherNative] Connection: ${previous} → ${current}`);
      },
      onError: (message, code, error) => {
        console.error('[pusherNative] Error:', message, code, error);
      },
    });

    await pusher.connect();
    _initialized = true;
    console.log('[pusherNative] ✅ Connected');
    return true;
  } catch (err) {
    console.error('[pusherNative] Failed to initialize native Pusher:', err);
    return false;
  }
}

// ─── Channel management ───────────────────────────────────────────────────────

/**
 * Subscribe to the driver's private location channel.
 */
export async function subscribeDriverChannel(driverId: string): Promise<boolean> {
  if (!isNativePusherAvailable()) return false;

  const pusher = getPusher();

  // Already subscribed to this driver's channel
  if (_subscribedDriverId === driverId && _channel) return true;

  // Unsubscribe from a previous channel
  if (_subscribedDriverId && _channel) {
    try {
      await pusher.unsubscribe({
        channelName: `private-driver-location-${_subscribedDriverId}`,
      });
    } catch {}
    _channel = null;
    _subscribedDriverId = null;
  }

  const channelName = `private-driver-location-${driverId}`;
  try {
    _channel = await pusher.subscribe({
      channelName,
      onEvent: (_event: PusherEvent) => {},
      onSubscriptionError: (message: string, e: any) => {
        console.error('[pusherNative] Subscription error:', message, e);
      },
      onSubscriptionSucceeded: () => {
        console.log(`[pusherNative] ✅ Subscribed to ${channelName}`);
      },
    });

    _subscribedDriverId = driverId;
    return true;
  } catch (err) {
    console.error('[pusherNative] Failed to subscribe to channel:', err);
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
 * Trigger a location update DIRECTLY on Pusher — no Next.js server involved.
 */
export async function triggerLocation(payload: NativeLocationPayload): Promise<boolean> {
  if (!isNativePusherAvailable() || !_channel) {
    return false;
  }

  try {
    await _channel.trigger({
      eventName: 'client-locationUpdate',
      data: {
        ...payload,
        timestamp: payload.timestamp ?? Date.now(),
      },
    });
    return true;
  } catch (err) {
    console.error('[pusherNative] Failed to trigger client event:', err);
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
    }

    await pusher.disconnect();
  } catch {}

  _initialized = false;
  console.log('[pusherNative] Disconnected');
}
