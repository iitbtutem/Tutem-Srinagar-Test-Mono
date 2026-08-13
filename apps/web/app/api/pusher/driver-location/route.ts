import { NextRequest, NextResponse } from 'next/server';
import { getDriverLatestLocation } from '@/lib/pusher-server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driverId');

  if (!driverId) {
    return NextResponse.json(
      { error: 'Missing driverId query parameter' },
      { status: 400 }
    );
  }

  const location = getDriverLatestLocation(driverId);
  return NextResponse.json({ success: true, location });
}
