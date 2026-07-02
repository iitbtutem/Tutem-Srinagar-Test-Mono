import * as Ably from 'ably';

const ABLY_API_KEY = process.env.EXPO_PUBLIC_ABLY_API_KEY;

let ably: Ably.Realtime | null = null;

/**
 * Returns a singleton instance of the Ably Realtime client.
 * Ensure EXPO_PUBLIC_ABLY_API_KEY is defined in your .env file.
 */
export const getAblyClient = (user_id?: string) => {
  // If the client exists but is in a failed state, clear it so it can be recreated
  if (ably && (ably.connection.state === 'failed' || ably.connection.state === 'closed')) {
    console.log(`Ably client is in ${ably.connection.state} state, clearing for recreation.`);
    ably = null;
  }

  if (!ably) {
    if (!ABLY_API_KEY) {
      console.error('Ably error: EXPO_PUBLIC_ABLY_API_KEY is not defined.');
      return null;
    }

    try {
      console.log('Initializing Ably Realtime Client...');
      ably = new Ably.Realtime({ 
        key: ABLY_API_KEY,
        clientId: user_id || 'driver-client',
        autoConnect: true,
        // Optional: you can add more robust connection settings here if needed
        recover: (lastName, lastSerial) => {
            console.log('Ably attempting to recover connection:', lastName, lastSerial);
        }
      });

      ably.connection.on((stateChange) => {
        console.log(`Ably Connection State: ${stateChange.previous} -> ${stateChange.current}`);
        if (stateChange.reason) {
          console.error('Ably Connection Error Reason:', stateChange.reason.message, `(Code: ${stateChange.reason.code})`);
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
 */
export const getDriverChannel = (driverId: string, user_id?: string) => {
  const client = getAblyClient(user_id);
  if (!client) return null;
  return client.channels.get(`driver:location:${driverId}`);
};

/**
 * Utility to get the global channel for active drivers.
 */
export const getGlobalChannel = (channelName: string = 'global:active-drivers', user_id?: string) => {
  const client = getAblyClient(user_id);
  if (!client) return null;
  return client.channels.get(channelName);
};
