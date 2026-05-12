export async function sendNotification({ 
  pushTokens, 
  title, 
  body, 
  data 
}: { 
  pushTokens: string[]; 
  title?: string; 
  body?: string; 
  data?: string; 
}) {
  const results = [];
  
  for (const pushToken of pushTokens) {
    // Validate Expo push token format
    if (!isValidExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken} is not a valid Expo push token`);
      continue;
    }

    const message = {
      to: pushToken,
      sound: "default",
      title: title ?? "Tutem",
      body: body ?? 'This notification is sent by Tutem',
      data: { data: data ?? 'rideId' },
      priority: "high" as const,
    };

    try {
      const headers: Record<string, string> = {
        "Accept": "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      };
      
      // Add authorization token if configured
      if (process.env.EXPO_ACCESS_TOKEN) {
        headers["Authorization"] = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
      }

      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers,
        body: JSON.stringify(message),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error("Push notification error:", result);
        results.push({ 
          success: false, 
          error: result, 
          pushToken,
          status: response.status 
        });
      } else {
        console.log("Push notification sent successfully:", result);
        results.push({ 
          success: true, 
          result, 
          pushToken 
        });
      }
    } catch (error) {
      console.error("Failed to send push notification:", error);
      results.push({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error), 
        pushToken 
      });
    }
  }
  
  return results;
}

function isValidExpoPushToken(token: string): boolean {
  // Expo push tokens start with "ExponentPushToken[" or "ExpoPushToken["
  return token.startsWith("ExponentPushToken[") || 
         token.startsWith("ExpoPushToken[");
}

// Optional: Helper function to send notification to a single token
export async function sendSingleNotification({
  pushToken,
  title,
  body,
  data
}: {
  pushToken: string;
  title?: string;
  body?: string;
  data?: string;
}) {
  const results = await sendNotification({
    pushTokens: [pushToken],
    title,
    body,
    data
  });
  return results[0];
}

// Optional: Helper function to send notifications in batches (more efficient for many tokens)
export async function sendBatchNotifications({
  pushTokens,
  title,
  body,
  data
}: {
  pushTokens: string[];
  title?: string;
  body?: string;
  data?: string;
}) {
  // Expo recommends sending chunks of up to 100 messages per request
  const chunkSize = 100;
  const chunks = [];
  
  for (let i = 0; i < pushTokens.length; i += chunkSize) {
    chunks.push(pushTokens.slice(i, i + chunkSize));
  }
  
  const allResults = [];
  
  for (const chunk of chunks) {
    const messages = [];
    
    for (const pushToken of chunk) {
      if (!isValidExpoPushToken(pushToken)) {
        console.error(`Push token ${pushToken} is not a valid Expo push token`);
        continue;
      }
      
      messages.push({
        to: pushToken,
        sound: "default",
        title: title ?? "Tutem",
        body: body ?? 'This notification is sent by Tutem',
        data: { data: data ?? 'rideId' },
        priority: "high" as const,
      });
    }
    
    if (messages.length === 0) continue;
    
    try {
      const headers: Record<string, string> = {
        "Accept": "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      };
      
      if (process.env.EXPO_ACCESS_TOKEN) {
        headers["Authorization"] = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
      }
      
      // Send multiple notifications in one request
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers,
        body: JSON.stringify(messages),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error("Batch push notification error:", result);
        allResults.push({ success: false, error: result, messages: messages.length });
      } else {
        console.log("Batch push notifications sent successfully:", result);
        allResults.push({ success: true, result, messages: messages.length });
      }
    } catch (error) {
      console.error("Failed to send batch push notifications:", error);
      allResults.push({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        messages: messages.length 
      });
    }
  }
  
  return allResults;
}