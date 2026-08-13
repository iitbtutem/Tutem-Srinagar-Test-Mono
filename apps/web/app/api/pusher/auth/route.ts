import { NextRequest, NextResponse } from 'next/server';
import { getPusherServer } from '@/lib/pusher-server';

/**
 * POST /api/pusher/auth
 *
 * Pusher channel authentication endpoint.
 * Called automatically by pusher-js (in web admin and rider/user app)
 * when subscribing to a private channel.
 *
 * Pusher sends: socket_id=<id>&channel_name=<name>  (form-encoded)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const socketId = params.get('socket_id');
    const channelName = params.get('channel_name');

    if (!socketId || !channelName) {
      return NextResponse.json(
        { error: 'Missing socket_id or channel_name' },
        { status: 400 }
      );
    }

    // Only allow our known private channels
    const isAllowed =
      channelName.startsWith('private-driver-location-') ||
      channelName === 'private-active-drivers';

    if (!isAllowed) {
      return NextResponse.json({ error: 'Unauthorized channel' }, { status: 403 });
    }

    const pusher = getPusherServer();
    const auth = pusher.authorizeChannel(socketId, channelName);

    // Return with CORS headers so mobile apps on local IPs can reach this
    return NextResponse.json(auth, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('[POST /api/pusher/auth] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handle preflight OPTIONS request from mobile apps
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
