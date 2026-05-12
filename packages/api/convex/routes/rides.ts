import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { TWENTY_FOUR_HOURS, OTP_SIZE, RADIUS_KM, METERS_IN_KM } from "../CONSTANTS";
import { s3Client } from "../s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Haversine formula — returns distance in km between two coordinates

export function numberFormat(number: number) {
  return new Intl.NumberFormat("en-In", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(number);
}

// 1 degree of latitude ≈ 111 km, so for a 3km radius:
// bounding box delta = 3 / 111 ≈ 0.027 degrees
const BOUNDING_BOX_DELTA = RADIUS_KM / 111;

export type NearbyDriverResult = {
  driver: Doc<"driver"> & {
    userDetails: Doc<"user"> & { profilePictureKey?: string };
    averageRating: number | null;
    totalRatings: number;
  };
  vehicle: Doc<"vehicle">;
  fare: number;
  cords: { latitude: number; longitude: number };
};

export const getNearbyDriversQueryResult = internalQuery({
  args: {
    driversInfo: v.array(v.object({
      driverId: v.id("driver"),
      latitude: v.number(),
      longitude: v.number(),
    })),
    genderMatch: v.boolean(),
    filters: v.array(
      v.union(v.literal("Bike"), v.literal("Cab"), v.literal("Auto")),
    ),
    distance: v.number(), // keep for fare calculation
    riderId: v.id("rider"),
  },
  handler: async (ctx, args) => {
    const { driversInfo } = args;
    const rider = await ctx.db.get(args.riderId);
    if (rider === null) throw new ConvexError("Invalid user");
    const riderUser = await ctx.db.get(rider.userId);
    if (riderUser === null) throw new ConvexError("Invalid user");

    console.log("nearby drivers from presence:", driversInfo);

    const drivers = await Promise.all(
      driversInfo.map(async (driver) => {
        const driverDetails = await ctx.db.get(driver.driverId);

        if ( driverDetails === null || driverDetails.isAvailableForRide === false) return null;
        console.log("driver details", driverDetails);

        const userDetails = await ctx.db.get(driverDetails.userId);
        console.log("userDetails", userDetails);
        if (userDetails === null) return null;

        const profilePictureUri = userDetails.profilePictureKey
          ? await getSignedUrl(
              s3Client,
              new GetObjectCommand({
                Bucket: process.env.MINIO_BUCKET,
                Key: userDetails.profilePictureKey,
              }),
              { expiresIn: 300 },
            )
          : undefined;

        if ( args.genderMatch === true && userDetails.gender !== riderUser.gender) return null;

        if ( driverDetails.genderMatching && riderUser.gender !== userDetails.gender) return null;

        const vehicle = await ctx.db
          .query("vehicle")
          .withIndex("by_owner", (q) => q.eq("ownerId", driver.driverId))
          .first();
        if (vehicle === null) return null;
        console.log("vehicle is", vehicle);

        if (args.filters.length > 0 && !args.filters.includes(vehicle.class)) { return null }

        const ratings = await ctx.db
          .query("ratings")
          .withIndex("by_driver", (q) => q.eq("driverId", driverDetails._id))
          .filter((q) => q.eq(q.field("raterType"), "Rider"))
          .collect();

        const averageRating = ratings.length === 0
            ? null
            : ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;


        const organizationRate = await ctx.db
            .query("organizationsRate")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", driverDetails.organizationId),
            )
            .filter((q) => q.eq(q.field("vehicleClass"), vehicle.class))
            .first();

          if (organizationRate === null) return null;

          const chargableDistanceInKms = args.distance / METERS_IN_KM - organizationRate.baseDistance;
          const fare = chargableDistanceInKms > 0 ? (organizationRate.baseDistanceRate + chargableDistanceInKms * organizationRate.ratePerKm): organizationRate.baseDistanceRate;

          return {
            driver: {
              ...driverDetails,
              userDetails: {
                ...userDetails,
                profilePictureKey: profilePictureUri,
              },
              averageRating,
              totalRatings: ratings.length,
            },
            vehicle: vehicle,
            fare: Math.round(fare),
            cords: {
              latitude: driver.latitude,
              longitude: driver.longitude,
            },
          };
        }),
    );

    const nearbyDriversWithDetails = drivers.filter((d) => d !== null);

    console.log("nearbyDriversWithDetails", nearbyDriversWithDetails);
    return nearbyDriversWithDetails;
  },
});


export const bookRide = internalMutation({
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
  handler: async (ctx, args) => {
    const rider = await ctx.db.get(args.riderId);
    if (rider === null) throw new ConvexError("Invalid user");
    const driver = await ctx.db.get(args.driverId);
    if (driver === null) throw new ConvexError("Driver doesn't exist");
    
    if(rider.userId === driver.userId)
      throw new ConvexError("Driver and rider cannot be same user");
    
    if (driver.isAvailableForRide === false || driver.isOnline === false)
      throw new ConvexError("Driver not available");
    
    const existingRide = await ctx.db
      .query("ride")
      .withIndex("by_rider", q => q.eq("riderId", rider._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "Active"),
          q.eq(q.field("status"), "Open"),
        ),
      )
      .first();

    if (existingRide !== null)
      throw new ConvexError("Can't book multiple rides at the same time");
    
    const rideId = await ctx.db.insert("ride", {
      riderId: rider._id,
      driverId: driver._id,
      requestStatus: "Pending",
      status: "Open",
      distance: args.distance,
      expectedDuration: args.expectedDuration,
      fare: args.fare,
      pickup: args.pickup,
      destination: args.destination,
      requestedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // await ctx.scheduler.runAfter(RESPONSE_TIME * 60 * 1000, internal.routes.rides.markNoResponse, { rideId })

    return {
      rideId,
      driverExpoPushToken: driver.expoPushToken,
    };
  },
});

export const markNoResponse = internalMutation({
  args: {
    rideId: v.id("ride"),
  },
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.rideId);
    if (ride === null) throw new ConvexError("Ride not found");
    if (ride.requestStatus !== "Pending") return;
    
    await ctx.db.patch(ride._id, {
      requestStatus: "No Response",
      updatedAt: Date.now(),
    });   

    const rider = await ctx.db.get(ride.riderId);
    if (rider === null) throw new ConvexError("Invalid user");
    
  },
});

export const changeDriver = internalMutation({
  args: {
    rideId: v.id("ride"),
    riderId: v.id("rider"),
    driverId: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.rideId);
    if(ride === null || ride.riderId !== args.riderId) throw new ConvexError("Ride not found");

    const driver = await ctx.db.get(ride.driverId);

    if(driver && driver.isAvailableForRide === false && ride.requestStatus === "Accepted"){
      await ctx.db.patch(driver._id, {
        isAvailableForRide: true,
      })
    }
    await ctx.db.patch(ride._id, {
      updatedAt: Date.now(),
      requestedAt: Date.now(),
      driverId: args.driverId,
      requestStatus: "Pending",
    });

    return ride;
  }
});

export const cancelRide = internalMutation({
  args: {
    riderId: v.id("rider"),
    rideId: v.id("ride"),
  },
  handler: async (ctx, args) => {
    const rider = await ctx.db.get(args.riderId);
    if (rider === null) throw new ConvexError("Invalid user");
    
    const ride = await ctx.db.get(args.rideId);
      
    if (ride === null || ride.riderId !== rider._id) throw new ConvexError("Ride not found");

    if (ride.status !== "Open")
      throw new ConvexError("Ride cannot cancelled at this stage");
    
    const driver = await ctx.db.get(ride.driverId);
    if (driver === null) throw new ConvexError("Invalid user");
    
    await ctx.db.patch(ride._id, {
      status: "Canceled",
      updatedAt: Date.now(),
    });

    if(driver.isAvailableForRide === false && ride.requestStatus === "Accepted"){
      await ctx.db.patch(driver._id, {
        isAvailableForRide: true,
      });
    };

    return ride.requestStatus === "Accepted" ? driver.expoPushToken : undefined;
  },
});

export const driverCancelRide = internalMutation({
  args: {
    rideId: v.id("ride"),
    driverId: v.id("driver"),
    reason: v.string()
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (driver === null) throw new ConvexError("Invalid user");
    
    const ride = await ctx.db.get(args.rideId);
      
    if (ride === null || ride.driverId !== driver._id) throw new ConvexError("Ride not found");

    if (ride.status === "Completed")
      throw new ConvexError("Cannot cancel completed ride");

    if (ride.status === "Canceled")
      throw new ConvexError("Ride is already canceled");
    
    const rider = await ctx.db.get(ride.riderId);
    if (rider === null) throw new ConvexError("Invalid user");
    
    if(ride.status === "Open" || ride.status === "Driver Arrived"){
      await ctx.db.patch(ride._id, {
        status: "Open",
        requestStatus: "Rejected",
        updatedAt: Date.now(),
      })
    } else{
      await ctx.db.patch(ride._id, {
        status: "Abort",
        updatedAt: Date.now(),
      });
    }
    
    await ctx.db.insert("rideReasons", {
      rideId: ride._id,
      driverId: ride.driverId,
      reason: args.reason
    });  

    await ctx.db.patch(driver._id, {
      isAvailableForRide: true,
    });

    return rider.expoPushToken;
  },
});

export const getDetails = internalQuery({
  args: {
    id: v.id("ride")
  },
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.id);
    if(ride === null) throw new ConvexError("Ride not found");
    return ride;
  }
});

export const rideOrganizationRate = internalQuery({
  args: {
    id: v.id("ride"),
  },
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.id);
    if(ride === null) throw new ConvexError("Ride not found");

    const driver = await ctx.db.get(ride.driverId);
    if(driver === null) throw new ConvexError("Invalid user");

    const vehicle = await ctx.db
    .query("vehicle")
    .withIndex("by_owner", q => q.eq("ownerId", driver._id))
    .first();
    if(vehicle === null) throw new ConvexError("Driver has no vehicle registered");

    const organization = await ctx.db.get(driver.organizationId);
    if(organization === null) throw new ConvexError("Driver is not associated with any organization");

    const organizationRate = await ctx.db
    .query("organizationsRate")
    .withIndex("by_organization", q => q.eq("organizationId", organization._id))
    .filter(q => q.eq(q.field("vehicleClass"), vehicle.class))
    .first();
    if(organizationRate === null) throw new ConvexError("Organization has no rates configured");

    return {
      organizationRate,
      ride,
    }
  }
})

export const rejectRide = internalMutation({
  args: {
    driverId: v.id("driver"),
    rideId: v.id("ride"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (driver === null) throw new ConvexError("Invalid user");
    
    const ride = await ctx.db
    .query("ride")
    .filter((q) =>
      q.and(
        q.eq(q.field("_id"), args.rideId),
        q.eq(q.field("driverId"), driver._id),
        ),
      )
      .first();
    if (ride === null) throw new ConvexError("Ride not found");

    if (ride.status !== "Open")
      throw new ConvexError("Ride cannot rejected at this stage");

    const rider = await ctx.db.get(ride.riderId);
    if (rider === null) throw new ConvexError("Invalid user");


    await ctx.db.patch("ride", ride._id, {
      requestStatus: "Rejected",
      updatedAt: Date.now(),
    });

    return rider.expoPushToken;
  },
});

export const acceptRide = internalMutation({
  args: {
    driverId: v.id("driver"),
    rideId: v.id("ride"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (driver === null) throw new ConvexError("Invalid user");

    const ride = await ctx.db.get(args.rideId);    

    if (ride === null || ride.driverId !== args.driverId) throw new ConvexError("Ride not found");

    const rider = await ctx.db.get(ride.riderId);
    if(rider === null) throw new ConvexError("Invalid rider")

    if (ride.status !== "Open")
      throw new ConvexError("Ride cannot be started at this stage");

    await ctx.db.patch(ride._id, {
      requestStatus: "Accepted",
      acceptedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.patch(driver._id, {
      isAvailableForRide: false,
    });

    return rider.expoPushToken;
  },
});

export const getRiderCurrentRideById = query({
  args: {
    id: v.id("ride")
  },
  handler: async (ctx, args) => {

    const ride = await ctx.db.get(args.id);

    if(ride === null)
      throw new ConvexError("Ride is not available");

    const rider = await ctx.db.get(ride.riderId);
    if (rider === null) throw new ConvexError("Invalid user");
    
    const riderDetails = await ctx.db.get(rider.userId);
    if (riderDetails === null) throw new ConvexError("Invalid user");
    
    const driver = await ctx.db.get(ride.driverId);
    if (driver === null) throw new ConvexError("Invalid driver");
    
    const vehicle = await ctx.db
    .query("vehicle")
    .withIndex("by_owner", (q) => q.eq("ownerId", driver._id))
    .first();
    
    const driverDetails = await ctx.db.get(driver.userId);
    if (driverDetails === null) throw new ConvexError("Invalid Driver");

    const driverRatings = await ctx.db
      .query("ratings")
      .withIndex("by_driver", (q) => q.eq("driverId", driver._id))
      .filter((q) => q.eq(q.field("raterType"), "Rider"))
      .collect();

    const riderRatings = await ctx.db
      .query("ratings")
      .withIndex("by_rider", (q) => q.eq("riderId", rider._id))
      .filter((q) => q.eq(q.field("raterType"), "Driver"))
      .collect();

    const driverAverageRating =
      driverRatings.length === 0
        ? null
        : driverRatings.reduce((sum, r) => sum + r.score, 0) / driverRatings.length;
    const driverTotalRating = driverRatings.length;

    const riderAverageRating =
      riderRatings.length === 0
        ? null
        : riderRatings.reduce((sum, r) => sum + r.score, 0) / riderRatings.length;
    const riderTotalRating = riderRatings.length;

    const driverProfilePictureUri = driverDetails.profilePictureKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: driverDetails.profilePictureKey,
          }),
          { expiresIn: 300 },
        )
      : undefined;

    const riderProfilePictureUri = riderDetails.profilePictureKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: riderDetails.profilePictureKey,
          }),
          { expiresIn: 300 },
        )
      : undefined;

    const distance = ride.distance / METERS_IN_KM; //converting to KM
    return {
      ...ride,
      distance,
      otp: ride.status === "Driver Arrived" ? ride.otp : null,
      rider: {
        ...rider,
        averageRating: riderAverageRating,
        totalRating: riderTotalRating,
        userDetails: {
          ...riderDetails,          
          profilePictureKey: riderProfilePictureUri,
        }
      },
      vehicle,
      driver: {
        ...driver,
        averageRating: driverAverageRating,
        totalRating: driverTotalRating,
        userDetails: {
          ...driverDetails,
          profilePictureKey: driverProfilePictureUri,
        },
      },
    };
  },
});

export const getRiderCurrentRideByRiderId = query({
  args: {
    riderId: v.id("rider"),
  },
  handler: async (ctx, args) => {   
    const ride = await ctx.db
      .query("ride")
      .withIndex("by_rider", q => q.eq("riderId", args.riderId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "Open"),
          q.eq(q.field("status"), "Active"),
        ),
      )
      .first();
      if (ride === null) return null;

    const rider = await ctx.db.get(ride.riderId);
    if (rider === null) throw new ConvexError("Invalid user");

    const riderDetails = await ctx.db.get(rider.userId);
    if (riderDetails === null) throw new ConvexError("Invalid user");

    const driver = await ctx.db.get(ride.driverId);
    if (driver === null) throw new ConvexError("Invalid driver");

    const vehicle = await ctx.db
      .query("vehicle")
      .withIndex("by_owner", (q) => q.eq("ownerId", driver._id))
      .first();

    const user = await ctx.db.get(driver.userId);

    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_driver", (q) => q.eq("driverId", driver._id))
      .filter((q) => q.eq(q.field("raterType"), "Rider"))
      .collect();

    const averageRating =
      ratings.length === 0
        ? null
        : ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
    const totalRating = ratings.length;

    const profilePictureUri = user?.profilePictureKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: user.profilePictureKey,
          }),
          { expiresIn: 300 },
        )
      : undefined;

    const distance = ride.distance / METERS_IN_KM; //converting to KM
    return {
      ...ride,
      distance,
      otp: ride.status === "Driver Arrived" ? ride.otp : null,
      rider: {
        ...rider,
        userDetails: riderDetails
      },
      vehicle,
      driver: {
        ...driver,
        averageRating,
        totalRating,
        userDetails: {
          ...user,
          profilePictureKey: profilePictureUri,
        },
      },
    };
  },
});

export const getRiderHistory = query({
  args: {
    riderId: v.id("rider"),
    statuses: v.optional(v.array(v.union(v.literal("Completed"), v.literal("Canceled")))),
  },
  handler: async (ctx, args) => {
    const rider = await ctx.db.get(args.riderId);
    if (rider === null) throw new ConvexError("Invalid user");

    const rides = await ctx.db
      .query("ride")
      .withIndex("by_rider", q => q.eq("riderId", args.riderId))
      .filter((q) => {
        const statusConditions =
          args.statuses && args.statuses?.length > 0
            ? args.statuses?.map((status) => q.eq(q.field("status"), status))
            : [
                q.eq(q.field("status"), "Completed"),
                q.eq(q.field("status"), "Canceled"),
              ];

        return q.or(...statusConditions)
      })
      .collect();

      const ridesWithDrivers = Promise.all(
        rides.map(async (ride) => {
          const driver = await ctx.db.get(ride.driverId);
          if (driver === null) return { ...ride, driver: null };

          const userDetails = await ctx.db.get(driver.userId);
          if (userDetails === null) return { ...ride, driver: null };

          // 3. Fetch all ratings where this rider was rated BY drivers (i.e. driver rated the rider)
          const riderRatings = rider 
            ? await ctx.db
                .query("ratings")
                .withIndex("by_driver", (q) => q.eq("driverId", driver._id))
                .filter((q) => q.eq(q.field("raterType"), "Rider"))
                .collect()
            : [];

          // 4. Compute average rating
          const averageRating =
            riderRatings.length > 0
              ? riderRatings.reduce((sum, r) => sum + r.score, 0) /
                riderRatings.length
              : null;

          const profilePictureUri = userDetails.profilePictureKey
            ? await getSignedUrl(
                s3Client,
                new GetObjectCommand({
                  Bucket: process.env.MINIO_BUCKET,
                  Key: userDetails.profilePictureKey,
                }),
                { expiresIn: 300 },
              )
            : undefined;

          return {
            ...ride,
            distance: ride.distance / METERS_IN_KM,
            driver: {
              ...driver,
              userDetails: {
                ...userDetails,
                profilePictureKey: profilePictureUri,
              },
              rating: {
                average: averageRating
                  ? Math.round(averageRating * 10) / 10
                  : null,
                totalRatings: riderRatings.length,
              },
            },
          };
        }),
      );

    return ridesWithDrivers;
  },
});

export const getDriverCurrentRideByDriverId = query({
  args: {
    driverId: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (driver === null) throw new ConvexError("Invalid user");

    const rides = await ctx.db
      .query("ride")
      .withIndex("by_driver", q => q.eq("driverId", args.driverId))
      .filter((q) =>
        q.and(
          q.eq(q.field("requestStatus"), "Accepted"), //not necessary
          q.or(
            q.eq(q.field("status"), "Active"),
            q.eq(q.field("status"), "Open"),
            q.eq(q.field("status"), "Driver Arrived"),
          ),
        ),
      )
      .collect();

    if (rides.length === 0) return null;

    const ride = rides.find(r => r.status === "Active") ?? rides[0];

    const rider = await ctx.db.get(ride.riderId);
    if(rider === null) return null;

    const { otp, ...rideDetails } = ride; //prevent otp from sending to driver

    return {
      ...rideDetails,
    };
  },
});

export const getRide = query({
  args: {
    id: v.id("ride"),
  },
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.id);
    if (ride === null) return null;

    const rider = await ctx.db.get(ride.riderId);
    if(rider === null) return null;

    const driver = await ctx.db.get(ride.driverId);
    if(driver === null) return null;

    // 2. Fetch user profile linked to rider
    const riderUser = await ctx.db.get(rider.userId);
    if (riderUser === null) throw new ConvexError("Invalid rider");
    const driverUser = await ctx.db.get(driver.userId);
    if (driverUser === null) throw new ConvexError("Invalid user");

    const riderRatings =  await ctx.db
      .query("ratings")
      .withIndex("by_rider", (q) => q.eq("riderId", rider._id))
      .filter((q) => q.eq(q.field("raterType"), "Driver"))
      .collect();
          
    const riderAverageRating =
      riderRatings.length > 0
        ? riderRatings.reduce((sum, r) => sum + r.score, 0) /
          riderRatings.length
        : null;

    const riderProfilePictureUri = riderUser.profilePictureKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: riderUser.profilePictureKey,
          }),
          { expiresIn: 300 },
        )
      : undefined;

    const driverRatings = await ctx.db
      .query("ratings")
      .withIndex("by_driver", (q) => q.eq("driverId", driver._id))
      .filter((q) => q.eq(q.field("raterType"), "Rider"))
      .collect();
          
    const driverAverageRating =
      driverRatings.length > 0
        ? driverRatings.reduce((sum, r) => sum + r.score, 0) /
          driverRatings.length
        : null;

    const driverProfilePictureUri = driverUser.profilePictureKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: driverUser.profilePictureKey,
          }),
          { expiresIn: 300 },
        )
      : undefined;

      

    const rideRatings = await ctx.db.query("ratings").withIndex("by_ride", q => q.eq("rideId", ride._id)).collect();
    
    const rideReasons = await ctx.db
      .query("rideReasons")
      .withIndex("by_ride", q => q.eq("rideId", ride._id))
      .filter(q => q.or(
        q.eq(q.field("driverId"), ride.driverId),
        q.eq(q.field("driverId"), undefined)
      ))
      .collect();    

    const { otp, ...rideDetails } = ride; //prevent otp from sending to driver
    
    return {
      ...rideDetails,
      distance: ride.distance / METERS_IN_KM,
      ratings: rideRatings,
      rideReasons,
      driver: {
        ...driver,
        details: {
          ...driverUser,
          profilePictureKey: driverProfilePictureUri,
        },
        ratings: {
          average: driverAverageRating !== undefined && driverAverageRating !== null
            ? Math.min(5, Math.max(0, Math.round(driverAverageRating * 10) / 10))
            : null,
          totalRatings: driverRatings.length,
        }
      },
      rider: {
        ...rider,
        details: {
          ...riderUser,
          profilePictureKey: riderProfilePictureUri,
        },
        ratings: {
          average: riderAverageRating !== undefined && riderAverageRating !== null
            ? Math.min(5, Math.max(0, Math.round(riderAverageRating * 10) / 10))
            : null,
          totalRatings: riderRatings.length,
        },
      },      
    };
  },
});

export const getRideRequests = query({
  args: {
    driverId: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (driver === null) throw new ConvexError("Invalid user");

    const rides = await ctx.db
      .query("ride")
      .withIndex("by_driver", q => q.eq("driverId", args.driverId))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "Open"),
          q.eq(q.field("requestStatus"), "Pending"),
        ),
      )
      .collect();

    const ridesWithDetails = await Promise.all(
      rides.map(async (ride) => {
        // 1. Fetch rider record
        const rider = await ctx.db.get(ride.riderId);

        // 2. Fetch user profile linked to rider
        const riderUser = rider ? await ctx.db.get(rider.userId) : null;
        if (riderUser === null) return;

        // 3. Fetch all ratings where this rider was rated BY drivers (i.e. driver rated the rider)
        const riderRatings = rider
          ? await ctx.db
              .query("ratings")
              .withIndex("by_rider", (q) => q.eq("riderId", rider._id))
              .filter((q) => q.eq(q.field("raterType"), "Driver"))
              .collect()
          : [];

        // 4. Compute average rating
        const averageRating =
          riderRatings.length > 0
            ? riderRatings.reduce((sum, r) => sum + r.score, 0) /
              riderRatings.length
            : null;

        const profilePictureUri = riderUser.profilePictureKey
          ? await getSignedUrl(
              s3Client,
              new GetObjectCommand({
                Bucket: process.env.MINIO_BUCKET,
                Key: riderUser.profilePictureKey,
              }),
              { expiresIn: 300 },
            )
          : undefined;

        return {
          ...ride,
          distance: ride.distance / METERS_IN_KM,
          rider: rider
            ? {
                _id: rider._id,
                isVerified: rider.isVerified,
                expoPushToken: rider.expoPushToken,
              }
            : null,
          riderProfile: riderUser
            ? {
                ...riderUser,
                profilePictureKey: profilePictureUri,
              }
            : null,
          riderRating: {
            average: averageRating ? Math.round(averageRating * 10) / 10 : null,
            totalRatings: riderRatings.length,
          },
        };
      }),
    );

    return ridesWithDetails;
  },
});

export const getDriverHistory = query({
  args: {
    driverId: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (driver === null) throw new ConvexError("Invalid user");

    const rides = await ctx.db
      .query("ride")
      .withIndex("by_driver", q => q.eq("driverId", driver._id))
      .filter((q) => (
        q.or(
          q.eq(q.field("status"), "Abort"),
          q.eq(q.field("status"), "Completed"),
        )
      ))
      .collect();

    const ridesWithRiders = Promise.all(
      rides.map(async (ride) => {
        const rider = await ctx.db.get(ride.riderId);
        if (rider === null) return { ...ride, rider: null };

        const userDetails = await ctx.db.get(rider.userId);
        if (userDetails === null) return { ...ride, rider: null };

        // 3. Fetch all ratings where this rider was rated BY drivers (i.e. driver rated the rider)
        const riderRatings = rider
          ? await ctx.db
              .query("ratings")
              .withIndex("by_rider", (q) => q.eq("riderId", rider._id))
              .filter((q) => q.eq(q.field("raterType"), "Driver"))
              .collect()
          : [];

        // 4. Compute average rating
        const averageRating =
          riderRatings.length > 0
            ? riderRatings.reduce((sum, r) => sum + r.score, 0) /
              riderRatings.length
            : null;

        const profilePictureUri = userDetails.profilePictureKey
          ? await getSignedUrl(
              s3Client,
              new GetObjectCommand({
                Bucket: process.env.MINIO_BUCKET,
                Key: userDetails.profilePictureKey,
              }),
              { expiresIn: 300 },
            )
          : undefined;

        return {
          ...ride,
          distance: ride.distance / METERS_IN_KM,
          rider: {
            ...rider,
            userDetails: {
              ...userDetails,
              profilePictureKey: profilePictureUri,
            },
            rating: {
              average: averageRating
                ? Math.round(averageRating * 10) / 10
                : null,
              totalRatings: riderRatings.length,
            },
          },
        };
      }),
    );

    return ridesWithRiders;
  },
});

export const getRideToStart = query({
  args: {
    id: v.id("ride"),
    driverId: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.id);

    if (
      !ride ||
      ride.driverId !== args.driverId ||
      ride.status !== "Driver Arrived" ||
      ride.requestStatus !== "Accepted"
    ) {
      return null;
    }

    // if (ride === null) throw new ConvexError("ride not found");
    // if (ride.status === "Active")
    //   throw new ConvexError("ride is already active");
    // if (ride.status === "Completed")
    //   throw new ConvexError("ride is already completed");
    // if (ride.status === "Canceled")
    //   throw new ConvexError("ride has been canceled");

    return ride;
  },
});

export const driverArrived = internalMutation({
  args: {
    rideId: v.id("ride"),
    driverId: v.id("driver"),
    otp: v.number(),
  },
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.rideId);
    if(ride === null || ride.driverId !== args.driverId) throw new ConvexError("Ride not found");
    
    const rider = await ctx.db.get(ride.riderId);
    if(rider === null) throw new ConvexError("Ride has invalid rider");

    await ctx.db.patch(ride._id, {
      otp: args.otp,
      status: "Driver Arrived",
      updatedAt: Date.now(),
      arrivedAt: Date.now(),
    });

    return rider.expoPushToken;
  }
});

export const generateRideOtp = internalMutation({
  args: {
    id: v.id("ride"),
    otp: v.number(),
  },
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.id);
    if(ride === null) throw new ConvexError("Ride not found");

    const rider = await ctx.db.get(ride.riderId);
    if(rider === null) throw new ConvexError("Rider details not found");

    await ctx.db.patch(ride._id, {
      otp: args.otp,
      updatedAt: Date.now(),
    });

    return rider.expoPushToken;
  }
});

export const startRide = internalMutation({
  args: {
    driverId: v.id("driver"),
    rideId: v.id("ride"),
    otp: v.number(),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (driver === null) throw new ConvexError("Invalid user");

    const ride = await ctx.db.get(args.rideId);

    if (ride === null || ride.driverId !== args.driverId) throw new ConvexError("Ride not found");
    if (ride.status !== "Driver Arrived")
      throw new ConvexError("Ride cannot be started at this stage");
    if (ride.requestStatus !== "Accepted")
      throw new ConvexError("Ride has not been accepted yet");
    if(ride.otp === undefined) throw new ConvexError("Otp not generated yet");
    if(ride.otp !== args.otp) throw new ConvexError("Invalid Otp");

    const rider = await ctx.db.get(ride.riderId);
    if(rider === null) throw new ConvexError("Invalid rider");

    await ctx.db.patch(ride._id, {
      status: "Active",
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return rider.expoPushToken;
  },
});

export const completeRide = internalMutation({
  args: {
    driverId: v.id("driver"),
    rideId: v.id("ride"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (driver === null) throw new ConvexError("Invalid user");

    const ride = await ctx.db.get(args.rideId);

    if (ride === null || ride.driverId !== args.driverId) throw new ConvexError("Ride not found");
    if (ride.status !== "Active")
      throw new ConvexError("Ride cannot be completed at this stage");

    const rider = await ctx.db.get(ride.riderId);
    if (rider === null) throw new ConvexError("Invalid rider");

    await ctx.db.patch(ride._id, {
      status: "Completed",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Mark driver as available again
    await ctx.db.patch(args.driverId, {
      isAvailableForRide: true,
    });

    return ride.expectedDuration;
  },
});

export const submitRating = mutation({
  args: {
    rideId: v.id("ride"),
    raterType: v.union(v.literal("Rider"), v.literal("Driver")),
    score: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.score < 1 || args.score > 5) {
      throw new ConvexError("Score must be between 1 and 5");
    }

    const ride = await ctx.db.get(args.rideId);
    if (ride === null) throw new ConvexError("Ride not found");
    if (ride.status !== "Completed")
      throw new ConvexError("Can only rate completed rides");

    // Prevent duplicate: same ride + same raterType
    const existing = await ctx.db
      .query("ratings")
      .filter((q) => q.eq(q.field("raterType"), args.raterType))
      .first();

    if (existing !== null)
      throw new ConvexError("You have already rated this ride");

    await ctx.db.insert("ratings", {
      rideId: args.rideId,
      riderId: ride.riderId,
      driverId: ride.driverId,
      raterType: args.raterType,
      score: args.score,
      comment: args.comment,
    });
  },
});

// Get both ratings for a single ride
export const getRideRatings = query({
  args: {
    rideId: v.id("ride"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ratings")
      .withIndex("by_ride", (q) => q.eq("rideId", args.rideId))
      .collect();
  },
});

// Get all ratings received by a driver + their average
export const getDriverRatings = query({
  args: {
    driverId: v.id("driver"),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db.get(args.driverId);
    if (driver === null) throw new ConvexError("Driver not found");

    // raterType "rider" means the rider rated the driver
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_driver", (q) => q.eq("driverId", args.driverId))
      .filter((q) => q.eq(q.field("raterType"), "Rider"))
      .collect();

    const average =
      ratings.length === 0
        ? null
        : ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;

    return { ratings, average, total: ratings.length };
  },
});

// Get all ratings received by a rider + their average
export const getRiderRatings = query({
  args: {
    riderId: v.id("rider"),
  },
  handler: async (ctx, args) => {
    const rider = await ctx.db.get(args.riderId);
    if (rider === null) throw new ConvexError("Rider not found");

    // raterType "driver" means the driver rated the rider
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_rider", (q) => q.eq("riderId", args.riderId))
      .filter((q) => q.eq(q.field("raterType"), "Driver"))
      .collect();

    const average =
      ratings.length === 0
        ? null
        : ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;

    return { ratings, average, total: ratings.length };
  },
});

export const updateRating = mutation({
  args: {
    ratingId: v.id("ratings"),
    raterType: v.union(v.literal("Rider"), v.literal("Driver")),
    raterId: v.union(v.id("rider"), v.id("driver")),
    score: v.optional(v.number()),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const rating = await ctx.db.get(args.ratingId);
    if (rating === null) throw new ConvexError("Rating not found");

    // Verify the caller is the one who submitted the rating
    const isOwner =
      args.raterType === "Rider"
        ? rating.riderId === args.raterId
        : rating.driverId === args.raterId;

    if (!isOwner || rating.raterType !== args.raterType) {
      throw new ConvexError("Unauthorized");
    }

    if (args.score !== undefined && (args.score < 1 || args.score > 5)) {
      throw new ConvexError("Score must be between 1 and 5");
    }

    const createdAt = new Date(rating._creationTime).getTime();
    if (Date.now() - createdAt > TWENTY_FOUR_HOURS) {
      throw new ConvexError(
        "Ratings can only be edited within 24 hours of submission",
      );
    }

    await ctx.db.patch(args.ratingId, {
      ...(args.score !== undefined && { score: args.score }),
      ...(args.comment !== undefined && { comment: args.comment }),
    });
  },
});

export const deleteRating = mutation({
  args: {
    ratingId: v.id("ratings"),
    raterType: v.union(v.literal("Rider"), v.literal("Driver")),
    raterId: v.union(v.id("rider"), v.id("driver")),
  },
  handler: async (ctx, args) => {
    const rating = await ctx.db.get(args.ratingId);
    if (rating === null) throw new ConvexError("Rating not found");

    const isOwner =
      args.raterType === "Rider"
        ? rating.riderId === args.raterId
        : rating.driverId === args.raterId;

    if (!isOwner || rating.raterType !== args.raterType) {
      throw new ConvexError("Unauthorized");
    }

    const createdAt = new Date(rating._creationTime).getTime();
    if (Date.now() - createdAt > TWENTY_FOUR_HOURS) {
      throw new ConvexError(
        "Ratings can only be deleted within 24 hours of submission",
      );
    }

    await ctx.db.delete(args.ratingId);
  },
});
