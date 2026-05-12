"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { sendNotification } from "../helpers/pushNotifications";

export const sendPushNotification = internalAction({
  args: {
    pushTokens: v.array(v.string()),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await sendNotification({
      pushTokens: args.pushTokens,
      title: args.title,
      body: args.body,
    });
  },
});
