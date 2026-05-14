"use node"

import { Expo } from 'expo-server-sdk';

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
//   useFcmV1: true,
});


export async function sendNotification({ pushTokens, title, body, data }: { pushTokens: string[], title?: string, body?: string, data?: string, }) {
  const messages = [];
  for (const pushToken of pushTokens) {

    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken as string} is not a valid Expo push token`);
      continue;
    }

    messages.push({
      to: pushToken,
      sound: 'default',
      title: title ?? "Arco Fenestration",
      body: body ?? 'This notification is sent by Arco Fenestration',
      data: { data: data ?? 'leadId' },
    })
  }
  
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error(error);
    }
  }
}
