import { fetch as backgroundFetch } from 'expo/fetch';
import type { LocationSnapshot } from './locationSnapshot';

let pendingRequest: AbortController | null = null;
let newest: { driverId: string; timestamp: number } | null = null;

export async function deliverDriverLocation(
  url: string,
  payload: LocationSnapshot & { driverId: string }
) {
  if (!url) throw new Error('Location endpoint is not configured');
  if (newest?.driverId === payload.driverId && newest.timestamp > payload.timestamp) return;
  newest = { driverId: payload.driverId, timestamp: payload.timestamp };
  const controller = new AbortController();
  // Foreground and background share one request slot. Reconnecting must not
  // replay a queue of stale positions from a WebSocket mutation client.
  pendingRequest?.abort();
  pendingRequest = controller;
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    // Global React Native fetch settles through JS timers, which paused in the
    // locked-device reproduction. Expo fetch completes through its native module.
    const response = await backgroundFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Location endpoint returned HTTP ${response.status}`);
    return true;
  } catch (error) {
    if (controller.signal.aborted && pendingRequest !== controller) return;
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (pendingRequest === controller) pendingRequest = null;
  }
}

export function cancelLocationDelivery() {
  pendingRequest?.abort();
  pendingRequest = null;
  newest = null;
}
