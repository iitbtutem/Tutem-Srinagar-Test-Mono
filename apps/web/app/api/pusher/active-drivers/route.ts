import { NextResponse } from 'next/server';
import { getActiveDriverIds } from '@/lib/pusher-server';

/**
 * GET /api/pusher/active-drivers
 *
 * Returns the current list of drivers actively sending location to Pusher.
 * Unlike the DB `isOnline` flag, this reflects drivers actually publishing
 * location updates (updated within the last 30 seconds).
 *
 * Called by the web tracking page on mount to seed the active-driver count
 * before any real-time events arrive.
 */
export async function GET() {
  try {
    const activeDriverIds = getActiveDriverIds();
    return NextResponse.json({
      activeDriverIds,
      count: activeDriverIds.length,
    });
  } catch (error) {
    console.error('[GET /api/pusher/active-drivers] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
