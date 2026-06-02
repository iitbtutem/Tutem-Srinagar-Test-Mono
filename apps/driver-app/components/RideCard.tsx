import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Button, Text } from '@tutem/ui';
import StarRating from "./StarRating";
import { distanceFormat, formatFare } from "@/lib/utils";
import { FunctionReturnType } from "convex/server";
import { api, Id } from "@tutem/api";
import { Feather } from "@expo/vector-icons";
import { format } from "date-fns";
import { colors } from "@/constants/colors";
import GenderAge from "./GenderAge";
import { useState } from "react";


type RideRequest = NonNullable<
  FunctionReturnType<typeof api.routes.rides.getRideRequests>[number]
>;

type RideHistory = NonNullable<
  FunctionReturnType<typeof api.routes.rides.getDriverHistory>[number]
>;

type CurrentRide = NonNullable<FunctionReturnType<typeof api.routes.rides.getDriverCurrentRideByDriverId>>;

export function RideRequestCard({
  ride,
  handleAccept,
  handleReject,
  acceptCheck
}: {
  ride: RideRequest;
  handleAccept: (rideId: Id<"ride">) => void;
  handleReject: (rideId: Id<"ride">) => void;
  acceptCheck: { ok: boolean; reason?: string };
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.delay(200)}
      style={animStyle}
      className="mb-3"
    >
      <View className="rounded-2xl border p-4 overflow-hidden bg-background border-violet-500/50">
        {/* Header */}
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <Text className="text-title text-base font-bold mb-1">
              {`${ride.rider.details.firstName ?? ''} ${ride.rider.details.lastName ?? ''}`.trim() || 'Passenger'}
            </Text>
            <View className="flex-row gap-1">
              <GenderAge gender={ride.rider.details.gender} dob={ride.rider.details.dob} />
              <StarRating rating={ride.rider.ratings} />
            </View>
          </View>
          <Text className="text-emerald-400 text-xl font-extrabold tracking-tight">
            {formatFare(ride.fare)}
          </Text>
        </View>

        {/* Route timeline */}
        <View className="flex-row items-stretch mb-3 pl-0.5">
          <View className="items-center w-4">
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.pickup }} />
            <View className="w-px flex-1 bg-slate-700 my-1" />
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.destination }} />
          </View>
          <View className="flex-1 ml-3 gap-2.5">
            <Text className="text-slate-400 text-[13px] font-medium" numberOfLines={1}>
              {ride.pickup?.address ?? 'Pickup location'}
            </Text>
            
            <View className="flex-row gap-3">
              <Text className="text-slate-400 text-xs font-semibold">📍 {distanceFormat(ride.distance) ?? "-"}</Text>
              {ride.expectedDuration && (
                <Text className="text-slate-400 text-xs font-semibold">⏱ {ride.expectedDuration}</Text>
              )}
            </View>

            <Text className="text-slate-400 text-[13px] font-medium" numberOfLines={1}>
              {ride.destination?.address ?? 'Dropoff location'}
            </Text>
          </View>
        </View>

        <View className="mt-2 flex-row gap-3">
          <Button
            size="sm"
            className=" flex-1 items-center justify-center rounded-2xl border-2 border-red-500/40 bg-red-500/10"
            onPress={() => handleReject(ride._id)}
          >
            <Text className="text-[15px] font-extrabold text-red-400">✕ Decline</Text>
          </Button>
          <Button
            size="sm"
            className={` flex-1 items-center justify-center rounded-2xl border-2 border-green-500 bg-green-600 ${!acceptCheck.ok ? 'opacity-30' : 'opacity-100'}`}
            onPress={() => handleAccept(ride._id)}
            disabled={!acceptCheck.ok}
          >
            <Text className="text-[15px] font-extrabold text-white">✓ Accept</Text>
          </Button>
        </View>
      </View>
    </Animated.View>
  );
}

export function RideHistoryCard({
  ride,
  onPress,
}: {
  ride: RideHistory;
  onPress: (ride: RideHistory) => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.delay(200)}
      style={animStyle}
      className="mb-3"
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 40 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 30 }); }}
        onPress={() => onPress(ride)}
        className="rounded-2xl border overflow-hidden bg-background border-violet-500/50"
      >
        {/* Header */}
        <View className="flex-row justify-between items-start mx-4 my-3">
          <View className="flex-1">
            <Text className="text-title text-base font-bold mb-1">
              {`${ride.rider?.userDetails?.firstName ?? ''} ${ride.rider?.userDetails?.lastName ?? ''}`.trim() || 'Passenger'}
            </Text>
          </View>
          <Text className="text-emerald-400 text-xl font-extrabold tracking-tight">
            {formatFare(ride.fare)}
          </Text>
        </View>

        {/* Route timeline */}
        <View className="flex-row items-stretch mx-4 mb-3 pl-0.5">
          <View className="items-center w-4">
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.pickup }} />
            <View className="w-px flex-1 bg-slate-700" />
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.destination }} />
          </View>
          <View className="flex-1 ml-3 gap-2.5">
            <Text className="text-slate-400 text-[13px] font-medium" numberOfLines={1}>
              {ride.pickup?.address ?? 'Pickup location'}
            </Text>
            <Text className="text-slate-400 text-[13px] font-medium" numberOfLines={1}>
              {ride.destination?.address ?? 'Dropoff location'}
            </Text>
          </View>
        </View>
        {ride.startedAt && <View className="flex-row justify-end items-center border-t border-gray-100 bg-primary/5 px-4 py-2">
          <View className="flex-row items-center">
            <Feather name="calendar" size={14} color="#9CA3AF" />
            <Text className="text-gray-500 text-xs ml-1.5">
              {format(new Date(ride.startedAt), 'dd MMM yyyy')}
            </Text>
          </View>
        </View>}
      </TouchableOpacity>
    </Animated.View>
  );
};

export function CurrentRideCard({
  ride,
  onPress,
}: {
  ride: CurrentRide;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.delay(200)}
      style={animStyle}
      className="mb-3 w-full"
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 40 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 30 }); }}
        onPress={onPress}
        className="rounded-xl border-2 border-primary bg-card shadow-sm p-4 overflow-hidden"
        >
        <View className="flex-row justify-between items-center border-b border-slate-950 pb-2">
          <Text className="text-primary font-bold">Current Ride</Text>
          <View className="bg-primary px-4 py-1 rounded-full">
            <Text className="text-white text-[10px] font-black uppercase">{ride.status === "Open" ? ride.requestStatus : ride.status}</Text>
          </View>
        </View>
        {/* Header */}
        <View className="flex-row justify-between items-start mb-3 mt-2">
          <View className="flex-1">
            <Text className="text-title text-base font-bold mb-1">
              {`${ride.rider.details.firstName ?? ''} ${ride.rider.details.lastName ?? ''}`.trim() || 'Passenger'}
            </Text>
            <View className="flex-row gap-1">
              <GenderAge gender={ride.rider.details.gender} dob={ride.rider.details.dob} />
              <StarRating rating={ride.rider.ratings} />
            </View>
          </View>
          <Text className="text-emerald-400 text-xl font-extrabold tracking-tight">
            {formatFare(ride.fare)}
          </Text>
        </View>

        {/* Route timeline */}
        <View className="flex-row items-stretch mb-3 pl-0.5">
          <View className="items-center w-4">
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.pickup }} />
            <View className="w-px flex-1 bg-slate-700" />
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.destination }} />
          </View>
          <View className="flex-1 ml-3 gap-2.5">
            <Text className="text-slate-400 text-[13px] font-medium" numberOfLines={1}>
              {ride.pickup?.address ?? 'Pickup location'}
            </Text>

            <View className="flex-row gap-3">
              <Text className="text-slate-400 text-xs font-semibold">📍 {distanceFormat(ride.distance) ?? "-"}</Text>
              {ride.expectedDuration && (
                <Text className="text-slate-400 text-xs font-semibold">⏱ {ride.expectedDuration}</Text>
              )}
            </View>

            <Text className="text-slate-400 text-[13px] font-medium" numberOfLines={1}>
              {ride.destination?.address ?? 'Dropoff location'}
            </Text>
          </View>
        </View>
        
      </TouchableOpacity>
    </Animated.View>
  );
}