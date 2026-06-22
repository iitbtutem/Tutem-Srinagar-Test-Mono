import { TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Text } from '@tutem/ui';
import StarRating from "./StarRating";
import { distanceFormat, formatFare } from "@/lib/utils";
import { FunctionReturnType } from "convex/server";
import { api } from "@tutem/api";
import { colors } from "@/constants/colors";
import { Feather } from "@expo/vector-icons";
import { format } from "date-fns";


type RideRequest = NonNullable<
  FunctionReturnType<typeof api.routes.rides.getRideRequests>[number]
>;

type RideHistory = NonNullable<
  FunctionReturnType<typeof api.routes.rides.getRiderHistory>[number]
>;

export function RideRequestCard({
  ride,
  isSelected,
  onPress,
}: {
  ride: RideRequest;
  isSelected: boolean;
  onPress: (ride: RideRequest) => void;
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
        className={`rounded-2xl border p-4 overflow-hidden ${
          isSelected
            ? 'bg-background border-violet-500/50'
            : 'bg-primary-background border-slate-800'
        }`}
      >
        {/* Header */}
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <Text className="text-primary text-base font-bold mb-1">
              {`${ride.rider.details?.firstName ?? ''} ${ride.rider.details?.lastName ?? ''}`.trim() || 'Passenger'}
            </Text>
            <StarRating rating={ride.rider.ratings} />
          </View>
          <Text className="text-emerald-400 text-xl font-extrabold tracking-tight">
            {formatFare(ride.fare)}
          </Text>
        </View>

        {/* Route timeline */}
        <View className="flex-row items-stretch mb-3 pl-0.5">
          <View className="items-center w-4">
            <View className="w-2 h-2 rounded-full bg-teal-500 mt-[3px]" />
            <View className="w-px flex-1 bg-slate-700 my-1" />
            <View className="w-2 h-2 rounded-full bg-violet-500" />
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

        {/* Footer */}
        <View className="flex-row gap-3">
          <Text className="text-slate-400 text-xs font-semibold">📍 {ride.distance} km</Text>
          {ride.expectedDuration && (
            <Text className="text-slate-400 text-xs font-semibold">⏱ {ride.expectedDuration}</Text>
          )}
        </View>
      </TouchableOpacity>
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
              {`${ride.driver?.userDetails?.firstName ?? ''} ${ride.driver?.userDetails?.lastName ?? ''}`.trim() || 'Passenger'}
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
