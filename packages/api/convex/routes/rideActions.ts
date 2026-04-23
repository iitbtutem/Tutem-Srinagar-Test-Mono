"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { sendNotification } from "../../pushNotifications";
import { Id } from "../_generated/dataModel";

export const acceptRideAction = action({
  args: {
    driverId: v.id("driver"),
    rideId: v.id("ride"),
  },
  handler: async (ctx, args) => {
    const riderExpoPushToken = await ctx.runMutation(
      internal.routes.rides.acceptRide,
      {
        driverId: args.driverId,
        rideId: args.rideId,
      },
    );

    if (!riderExpoPushToken) return;

    // Send push notification (requires Node.js)
    await sendNotification({
      pushTokens: [riderExpoPushToken],
      title: "Ride Accepted 🚗",
      body: "Your driver has accepted the ride. Share the OTP with the driver to start your trip.",
    });
  },
});

export const bookRide = action({
  args: {
    riderId: v.id("rider"),
    driverId: v.id("driver"),
    fare: v.number(),
    pickup: v.object({
      address: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
    destination: v.object({
      address: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
    distance: v.number(),
    expectedDuration: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"ride">> => {
    const ride = await ctx.runMutation(
      internal.routes.rides.bookRide,
      {
        riderId: args.riderId,
        driverId: args.driverId,
        fare: args.fare,
        pickup: args.pickup,
        destination: args.destination,
        distance: args.distance,
        expectedDuration: args.expectedDuration,
      },
    );

    if (ride.driverExpoPushToken)
      await sendNotification({
        pushTokens: [ride.driverExpoPushToken],
        title: "New Ride Request 🚖",
        body: "You have received a new ride request. Open the app to view trip details and accept it.",
      });
    return ride.rideId;
  },
});

export const cancelRide = action({
  args: {
    riderId: v.id("rider"),
    rideId: v.id("ride"),
  },
  handler: async (ctx, args) => {
    const riderExpoPushToken = await ctx.runMutation(
      internal.routes.rides.cancelRide,
      {
        riderId: args.riderId,
        rideId: args.rideId,
      },
    );

    if (!riderExpoPushToken) return;

    // Send push notification (requires Node.js)
    await sendNotification({
      pushTokens: [riderExpoPushToken],
      title: "Ride Cancelled ❌",
      body: "Your ride request has been cancelled successfully.",
    });
  },
});

export const rejectRide = action({
  args: {
    driverId: v.id("driver"),
    rideId: v.id("ride"),
  },
  handler: async (ctx, args) => {
    const riderExpoPushToken = await ctx.runMutation(
      internal.routes.rides.rejectRide,
      {
        driverId: args.driverId,
        rideId: args.rideId,
      },
    );

    if (!riderExpoPushToken) return;

    // Send push notification (requires Node.js)
    await sendNotification({
      pushTokens: [riderExpoPushToken],
      title: "Ride Request Declined 🚫",
      body: "The driver declined your ride request. Please choose another driver to continue.",
    });
  },
});

export const startRide = action({
  args: {
    driverId: v.id("driver"),
    rideId: v.id("ride"),
    otp: v.string(),
  },
  handler: async (ctx, args) => {
    const riderExpoPushToken = await ctx.runMutation(
      internal.routes.rides.startRide,
      {
        driverId: args.driverId,
        rideId: args.rideId,
        otp: args.otp,
      },
    );

    if (!riderExpoPushToken) return;

    // Send push notification (requires Node.js)
    await sendNotification({
      pushTokens: [riderExpoPushToken],
      title: "Ride Started 🚘",
      body: "Your driver has started the ride. Sit back and enjoy your trip!",
    });
  },
});

export const completeRide = action({
  args: {
    driverId: v.id("driver"),
    rideId: v.id("ride"),
  },
  handler: async (ctx, args) => {
    const riderExpoPushToken = await ctx.runMutation(
      internal.routes.rides.completeRide,
      {
        driverId: args.driverId,
        rideId: args.rideId,
      },
    );

    if (!riderExpoPushToken) return;

    // Send push notification (requires Node.js)
    await sendNotification({
      pushTokens: [riderExpoPushToken],
      title: "Ride Completed 🎉",
      body: "Your ride has been completed successfully. Thank you for riding with us!",
    });
  },
});
