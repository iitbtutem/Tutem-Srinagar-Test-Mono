import * as Ably from 'ably';

const ABLY_API_KEY = process.env.EXPO_PUBLIC_ABLY_API_KEY;

let ably: Ably.Realtime | null = null;

/**
 * Returns a singleton instance of the Ably Realtime client.
 * Ensure EXPO_PUBLIC_ABLY_API_KEY is defined in your .env file.
 */
export const getAblyClient = () => {
  if (ably && (ably.connection.state === 'failed' || ably.connection.state === 'closed')) {
    ably = null;
  }

  if (!ably) {
    if (!ABLY_API_KEY) {
      console.error('Ably error: EXPO_PUBLIC_ABLY_API_KEY is not defined.');
      return null;
    }

    try {
      ably = new Ably.Realtime({ 
        key: ABLY_API_KEY,
        clientId: 'user-client',
        autoConnect: true,
      });

      ably.connection.on((stateChange) => {
        console.log(`Ably Connection State: ${stateChange.previous} -> ${stateChange.current}`);
        if (stateChange.reason) {
          console.error('Ably Connection Error Reason:', stateChange.reason.message);
        }
      });
    } catch (error) {
      console.error('Failed to instantiate Ably:', error);
    }
  }
  return ably;
};

/**
 * Utility to get a specific driver's location channel.
 * For subscribing, you can pass additional params like { rewind: '1' } 
 */
export const getDriverChannel = (driverId: string, params?: Ably.ChannelOptions['params']) => {
  const client = getAblyClient();
  if (!client) return null;
  return client.channels.get(`driver:location:${driverId}`, { params });
};
