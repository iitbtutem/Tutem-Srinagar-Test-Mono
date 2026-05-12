"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { sendNotification } from "../helpers/pushNotifications";
import { Id } from "../_generated/dataModel";
import { fetchRoute } from "../helpers/maps";
import { METERS_IN_KM } from "../CONSTANTS";

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

export const changeDriver = action({
  args: {
    rideId: v.id("ride"),
    riderId: v.id("rider"),
    driverId: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const ride = await ctx.runMutation(
      internal.routes.rides.changeDriver, 
      {
        rideId: args.rideId,
        riderId: args.riderId,
        driverId: args.driverId,
      }
    );

    const driverExpoPushToken = await ctx.runQuery(
      internal.routes.driver.getDriverExpoPushToken,
      {
        id: args.driverId,
      }
    );

    if (driverExpoPushToken && ride.requestStatus === "Accepted")
      await sendNotification({
        pushTokens: [driverExpoPushToken],
        title: "Ride Canceled 🚖",
        body: "Your current ride has been canceled by rider. You can now a accept new ride request.",
      });
  }
});

export const cancelRide = action({
  args: {
    riderId: v.id("rider"),
    rideId: v.id("ride"),
  },
  handler: async (ctx, args) => {
    const driverExpoPushToken = await ctx.runMutation(
      internal.routes.rides.cancelRide,
      {
        riderId: args.riderId,
        rideId: args.rideId,
      },
    );

    if (!driverExpoPushToken) return;

    // Send push notification (requires Node.js)
    await sendNotification({
      pushTokens: [driverExpoPushToken],
      title: "Ride Cancelled ❌",
      body: "Your ride request has been cancelled successfully.",
    });
  },
});

export const calculateDriverCancelRideCharges = action({
  args: {
    id: v.id("ride"),
    driverLocation: v.object({
      latitude: v.number(),
      longitude: v.number()
    })
  },
  handler: async (ctx, args): Promise<{ calculatedFare: number; baseDistance: number; basePrice: number; ratePerKm: number; chargableDistance: number;  remainingDistance: number }> => {
    const rideDetails = await ctx.runQuery(internal.routes.rides.getDetails, { id: args.id });

    const { address, ...cords } = rideDetails.destination;
    const route = await fetchRoute(args.driverLocation, cords);

    console.log("Route : ", route)
    
    const remainingDistance = Number(route?.distance.value) ?? 0
    const { organizationRate, ride } = await ctx.runQuery(internal.routes.rides.rideOrganizationRate, { id: rideDetails._id });
    
    const baseDistance = organizationRate.baseDistance;
    const basePrice = organizationRate.baseDistanceRate;
    const ratePerKm = organizationRate.ratePerKm;
    
    const chargableDistance = ride.distance - remainingDistance;

    const calculatedFare = chargableDistance > baseDistance 
    ? (basePrice + ((chargableDistance - baseDistance)/METERS_IN_KM) * ratePerKm)
    : ((chargableDistance/METERS_IN_KM) * ratePerKm);
    
    console.log('calculatedFare ', calculatedFare )
    return  {
      calculatedFare: Math.max(0, calculatedFare),
      baseDistance,
      basePrice,
      ratePerKm,
      chargableDistance: Math.max(0, chargableDistance/METERS_IN_KM),
      remainingDistance: route?.distance.value ? route.distance.value/METERS_IN_KM : 0,
    }
  }
});

export const driverCancelRide = action({
  args: {
    rideId: v.id("ride"),
    driverId: v.id("driver"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const riderExpoPushToken = await ctx.runMutation(
      internal.routes.rides.driverCancelRide,
      {
        rideId: args.rideId,
        driverId: args.driverId,
        reason: args.reason,
      }
    );
    if (!riderExpoPushToken) return;

    // Send push notification (requires Node.js)
    await sendNotification({
      pushTokens: [riderExpoPushToken],
      title: "Ride Aborted 🚫",
      body: "The driver aborted your ride. Please book a new ride or change your driver if possible.",
    });
  }
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

export const driverArrived = action({
  args: {
    rideId: v.id("ride"),
    driverId: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const crypto = require("crypto");
    const otp = crypto.randomInt(1000, 10000);

    console.log("otp : ", otp)
    const riderExpoPushToken = await ctx.runMutation(internal.routes.rides.driverArrived, {
      driverId: args.driverId,
      rideId: args.rideId,
      otp
    });

    if (!riderExpoPushToken) return;

    // Send push notification (requires Node.js)
    await sendNotification({
      pushTokens: [riderExpoPushToken],
      title: "Driver Arrived 🚗",
      body: "Your driver has reached the pickup location. Please share the OTP from ride details to begin the ride.",
    });
  }
});

export const generateRideOtp = action({
  args: {
    rideId: v.id("ride"),
  },
  handler: async (ctx, args) => {
    const crypto = require("crypto");
    const otp = crypto.randomInt(1000, 10000);
    
    const riderExpoPushToken = await ctx.runMutation(internal.routes.rides.generateRideOtp, {
      id: args.rideId,
      otp
    });

    if (!riderExpoPushToken) return;

    // Send push notification (requires Node.js)
    await sendNotification({
      pushTokens: [riderExpoPushToken],
      title: "OTP generated",
      body: "New Ride OTP has been generated. Please share the OTP from ride details to begin the ride.",
    });
  }
});

export const startRide = action({
  args: {
    driverId: v.id("driver"),
    rideId: v.id("ride"),
    otp: v.number(),
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
