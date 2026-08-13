import Pusher from 'pusher';

let _pusherServer: Pusher | null = null;

/**
 * Returns the singleton Pusher server-side SDK instance.
 * Uses PUSHER_APP_ID, PUSHER_APP_KEY, PUSHER_APP_SECRET, PUSHER_CLUSTER.
 */
export function getPusherServer(): Pusher {
  if (!_pusherServer) {
    _pusherServer = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_APP_KEY!,
      secret: process.env.PUSHER_APP_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    });
  }
  return _pusherServer;
}

// ---------------------------------------------------------------------------
// Active-driver registry
// Tracks drivers that are *actively sending location* (not just isOnline in DB)
// ---------------------------------------------------------------------------

/**
 * driverId → Unix timestamp (ms) of last location publish
 */
const activeDriverRegistry = new Map<string, number>();

export interface DriverLatestLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

const driverLocationRegistry = new Map<string, DriverLatestLocation>();

/**
 * Entries older than this are considered stale (driver stopped publishing)
 */
const STALE_THRESHOLD_MS = 30_000; // 30 seconds

/**
 * Record that a driver just sent a location update.
 */
export function markDriverActive(driverId: string): void {
  activeDriverRegistry.set(driverId, Date.now());
}

export function updateDriverLatestLocation(loc: DriverLatestLocation): void {
  activeDriverRegistry.set(loc.driverId, Date.now());
  driverLocationRegistry.set(loc.driverId, loc);
}

export function getDriverLatestLocation(
  driverId: string,
): DriverLatestLocation | null {
  return driverLocationRegistry.get(driverId) ?? null;
}

/**
 * Returns the list of driver IDs that have published a location update
 * within the last STALE_THRESHOLD_MS milliseconds.
 * Prunes stale entries on every call.
 */
export function getActiveDriverIds(): string[] {
  const now = Date.now();
  for (const [id, lastSeen] of activeDriverRegistry.entries()) {
    if (now - lastSeen > STALE_THRESHOLD_MS) {
      activeDriverRegistry.delete(id);
      driverLocationRegistry.delete(id);
    }
  }
  return Array.from(activeDriverRegistry.keys());
}
