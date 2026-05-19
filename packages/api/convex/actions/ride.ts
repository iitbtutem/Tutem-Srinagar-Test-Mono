"use node";

import { action } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { fetchRoute, getAddressFromCoords } from "../helpers/maps";
import { METERS_IN_KM } from "../CONSTANTS";
import { sendNotification } from "../helpers/pushNotifications";

export const acceptRideAction = action({
  args: {
    driverId: v.id("driver"),
    rideId: v.id("ride"),
  },
  handler: async (ctx, args) => {
    const riderExpoPushToken = await ctx.runMutation(
      internal.routes.rides.acceptRideInternal,
      {
        driverId: args.driverId,
        rideId: args.rideId,
      },
    );

    if (!riderExpoPushToken) return;
    
    await sendNotification({
      pushTokens: [riderExpoPushToken],
      title: "Ride Accepted 🚗",
      body: "Your driver is on the way. Please be ready at the pickup location.",
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
      internal.routes.rides.bookRideInternal,
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
      internal.routes.rides.changeDriverInternal, 
      {
        rideId: args.rideId,
        riderId: args.riderId,
      }
    );

    const driver = await ctx.runQuery(
      internal.routes.driver.getDriverInternal,
      {
        id: args.driverId,
      }
    );

    if (driver.expoPushToken && ride.requestStatus === "Accepted")
      await sendNotification({
        pushTokens: [driver.expoPushToken],
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
      internal.routes.rides.cancelRideInternal,
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
      body: "The passenger has cancelled the ride. You are now available for new requests."
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
    const rideDetails = await ctx.runQuery(internal.routes.rides.getDetailsInternal, { id: args.id });

    const { address, ...cords } = rideDetails.destination;
    const route = await fetchRoute(args.driverLocation, cords);
    const remainingDistanceInMts = Number(route?.distance.value) ?? 0;
    
    const { organizationRate: orgRate, ride } = await ctx.runQuery(internal.routes.rides.rideOrganizationRateInternal, { id: rideDetails._id });
    
    const settings = await ctx.runQuery(internal.routes.settings.rideSettingsInternal);
    const arrivedRadiusInMts = settings.arrivedDistance;

    const distanceCoveredInMts = Math.max(0, ride.distance - remainingDistanceInMts) ;
    const chargableDistanceInMts = distanceCoveredInMts <= arrivedRadiusInMts ? 0 : distanceCoveredInMts;
    
    const calculatedFare = chargableDistanceInMts < orgRate.baseDistance
      ? (chargableDistanceInMts / METERS_IN_KM) * orgRate.ratePerKm
      : orgRate.baseDistanceRate + 
      (chargableDistanceInMts - orgRate.baseDistance) / METERS_IN_KM * orgRate.ratePerKm;
    
    return {
      calculatedFare: Math.max(0, Math.round(calculatedFare)),
      baseDistance: orgRate.baseDistance,
      basePrice: orgRate.baseDistanceRate,
      ratePerKm: orgRate.ratePerKm,
      chargableDistance: chargableDistanceInMts,
      remainingDistance: remainingDistanceInMts,
    }
  }
});

export const driverCancelRide = action({
  args: {
    rideId: v.id("ride"),
    driverId: v.id("driver"),
    reason: v.string(),
    driverLocation: v.object({
      latitude: v.number(),
      longitude: v.number(),
    })
  },
  handler: async (ctx, args) => {
    const ride = await ctx.runQuery(internal.routes.rides.getDetailsInternal, { id: args.rideId });

    const driver = await ctx.runQuery(
      internal.routes.driver.getDriverInternal,
      {
        id: ride.driverId,
      }
    );

    let fare: number = ride.fare;
    let chargableDistanceInMts: number = ride.distance;
    let dropOffAddress: string | null = null;

    if(ride.status === "Active"){
      const organizationRates = await ctx.runQuery(
        internal.routes.organizations.getOrganizationRatesInternal,
        {
          organizationId: driver.organizationId
        }
      );

      const settings = await ctx.runQuery(internal.routes.settings.rideSettingsInternal);
      const arrivedRadiusInMts = settings.arrivedDistance;

      const orgRate = organizationRates.find(rate => rate.vehicleClass === driver.vehicle?.class);
      if(orgRate === undefined) throw new ConvexError("Driver doesn't belong to any organization");

      const { address, ...cords } = ride.destination;
      const route = await fetchRoute(args.driverLocation, cords);
      const remainingDistanceInMts = Number(route?.distance.value) ?? 0;
      
      dropOffAddress = remainingDistanceInMts > arrivedRadiusInMts ? await getAddressFromCoords(args.driverLocation) : null;

      const distanceCoveredInMts = Math.max(0, ride.distance - remainingDistanceInMts);
      chargableDistanceInMts = distanceCoveredInMts <= arrivedRadiusInMts ? 0 : distanceCoveredInMts

      fare = chargableDistanceInMts < orgRate.baseDistance
        ? (chargableDistanceInMts / METERS_IN_KM) * orgRate.ratePerKm
        : orgRate.baseDistanceRate + 
        (chargableDistanceInMts - orgRate.baseDistance) / METERS_IN_KM * orgRate.ratePerKm;
    };
    
    const riderExpoPushToken = await ctx.runMutation(
      internal.routes.rides.driverCancelRideInternal,
      {
        rideId: args.rideId,
        driverId: args.driverId,
        reason: args.reason,
        calculatedFare: Math.round(fare),
        distance: chargableDistanceInMts,
        ...(chargableDistanceInMts > 0 && dropOffAddress) ? {
          dropOff: {
          ...args.driverLocation,
          address: dropOffAddress,
        }
        } : undefined,
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
      internal.routes.rides.rejectRideInternal,
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
    
    const riderExpoPushToken = await ctx.runMutation(internal.routes.rides.driverArrivedInternal, {
      driverId: args.driverId,
      rideId: args.rideId,
      otp
    });

    if (!riderExpoPushToken) return;

    // Send push notification (requires Node.js)
    await sendNotification({
      pushTokens: [riderExpoPushToken],
      title: "Driver Arrived 🚗",
      body: "Your driver has reached the pickup point. Please provide the OTP from ride details to start the ride."
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
    
    const riderExpoPushToken = await ctx.runMutation(internal.routes.rides.generateRideOtpInternal, {
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
      internal.routes.rides.startRideInternal,
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
    driverLocation: v.object({
      latitude: v.number(),
      longitude: v.number(),
    })
  },
  handler: async (ctx, args) => {

    const ride = await ctx.runQuery(internal.routes.rides.getDetailsInternal, { id: args.rideId });

    const driver = await ctx.runQuery(
      internal.routes.driver.getDriverInternal,
      {
        id: ride.driverId,
      }
    );

    const organizationRates = await ctx.runQuery(
      internal.routes.organizations.getOrganizationRatesInternal,
      {
        organizationId: driver.organizationId
      }
    );

    const settings = await ctx.runQuery(internal.routes.settings.rideSettingsInternal);
    const arrivedRadiusInMts = settings.arrivedDistance;

    const orgRate = organizationRates.find(rate => rate.vehicleClass === driver.vehicle?.class);
    if(orgRate === undefined) throw new ConvexError("Driver doesn't belong to any organization");

    const { address, ...cords } = ride.destination;
    const route = await fetchRoute(args.driverLocation, cords);
    
    const extraDistanceInMts = (route && route.distance.value > arrivedRadiusInMts) ? route.distance.value : 0;
    
    const dropOffAddress = extraDistanceInMts > 0 ? await getAddressFromCoords(args.driverLocation) : null;

    const rideDistance = ride.distance + extraDistanceInMts;
    const fare = extraDistanceInMts > 0 
      ? (ride.fare + ((extraDistanceInMts / METERS_IN_KM) * orgRate.ratePerKm))
      : ride.fare;
    
    const riderExpoPushToken = await ctx.runMutation(
      internal.routes.rides.completeRideInternal,
      {
        driverId: args.driverId,
        rideId: args.rideId,
        calculatedFare: Math.round(fare),
        distance: rideDistance,
        ...(extraDistanceInMts > 0 && dropOffAddress) ? {
          dropOff: {
          ...args.driverLocation,
          address: dropOffAddress,
        }
        } : undefined,
      },
    );
    
    if (riderExpoPushToken){
      await sendNotification({
        pushTokens: [riderExpoPushToken],
        title: "Ride Completed 🎉",
        body: "Your ride has been completed successfully. Thank you for riding with us. View your ride fare in ride details.",
      });
    }
  },
});
