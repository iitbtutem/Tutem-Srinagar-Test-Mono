import { TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Text } from '@tutem/ui';
import StarRating from './StarRating';
import { formatFare } from '@/lib/utils';
import { FunctionReturnType } from 'convex/server';
import { api } from '@tutem/api';
import { colors } from '@/constants/colors';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useEffect } from 'react';

export function RideCardSkeleton() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View className="mb-3 overflow-hidden rounded-2xl border border-violet-500/30 bg-background">
      {/* Header */}
      <View className="mx-4 my-3 flex-row items-start justify-between">
        <Animated.View style={animStyle} className="mr-4 flex-1">
          <View className="mb-2 h-4 w-32 rounded-md bg-slate-300/75" />
        </Animated.View>
        <Animated.View style={animStyle}>
          <View className="h-5 w-16 rounded-md bg-slate-300/75" />
        </Animated.View>
      </View>

      {/* Route timeline */}
      <View className="mx-4 mb-3 flex-row items-stretch pl-0.5">
        <View className="w-4 items-center">
          <View className="h-2 w-2 rounded-full bg-slate-300/75" />
          <View className="my-1 w-px flex-1 bg-slate-300/75" />
          <View className="h-2 w-2 rounded-full bg-slate-300/75" />
        </View>
        <Animated.View style={animStyle} className="ml-3 flex-1 gap-2.5">
          <View className="h-3 w-full rounded-md bg-slate-300/75" />
          <View className="h-3 w-3/4 rounded-md bg-slate-300/75" />
        </Animated.View>
      </View>

      {/* Footer strip */}
      <Animated.View
        style={animStyle}
        className="flex-row items-center justify-end border-t border-slate-200 bg-primary/5 px-4 py-2">
        <View className="h-3 w-24 rounded-md bg-slate-300/75" />
      </Animated.View>
    </View>
  );
}

type RideRequest = NonNullable<FunctionReturnType<typeof api.routes.rides.getRideRequests>[number]>;

type RideHistory = NonNullable<
  FunctionReturnType<typeof api.routes.rides.getRiderHistory>['page'][number]
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
    <Animated.View entering={FadeInDown.delay(200)} style={animStyle} className="mb-3">
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 40 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 30 });
        }}
        onPress={() => onPress(ride)}
        className={`overflow-hidden rounded-2xl border p-4 ${
          isSelected
            ? 'border-violet-500/50 bg-background'
            : 'bg-primary-background border-slate-800'
        }`}>
        {/* Header */}
        <View className="mb-3 flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="mb-1 text-base font-bold text-primary">
              {`${ride.rider.details?.firstName ?? ''} ${ride.rider.details?.lastName ?? ''}`.trim() ||
                'Passenger'}
            </Text>
            <StarRating rating={ride.rider.ratings} />
          </View>
          <Text className="text-xl font-extrabold tracking-tight text-emerald-400">
            {formatFare(ride.fare)}
          </Text>
        </View>

        {/* Route timeline */}
        <View className="mb-3 flex-row items-stretch pl-0.5">
          <View className="w-4 items-center">
            <View className="mt-[3px] h-2 w-2 rounded-full bg-teal-500" />
            <View className="my-1 w-px flex-1 bg-slate-700" />
            <View className="h-2 w-2 rounded-full bg-violet-500" />
          </View>
          <View className="ml-3 flex-1 gap-2.5">
            <Text className="text-[13px] font-medium text-slate-400" numberOfLines={1}>
              {ride.pickup?.address ?? 'Pickup location'}
            </Text>
            <Text className="text-[13px] font-medium text-slate-400" numberOfLines={1}>
              {ride.destination?.address ?? 'Dropoff location'}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View className="flex-row gap-3">
          <Text className="text-xs font-semibold text-slate-400">📍 {ride.distance} km</Text>
          {ride.expectedDuration && (
            <Text className="text-xs font-semibold text-slate-400">⏱ {ride.expectedDuration}</Text>
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
    <Animated.View entering={FadeInDown.delay(200)} style={animStyle} className="mb-3">
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 40 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 30 });
        }}
        onPress={() => onPress(ride)}
        className="overflow-hidden rounded-2xl border border-violet-500/50 bg-background">
        {/* Header */}
        <View className="mx-4 my-3 flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-title mb-1 text-base font-bold">
              {`${ride.driver?.userDetails?.firstName ?? ''} ${ride.driver?.userDetails?.lastName ?? ''}`.trim() ||
                'Passenger'}
            </Text>
          </View>
          <Text className="text-xl font-extrabold tracking-tight text-emerald-400">
            {formatFare(ride.fare)}
          </Text>
        </View>

        {/* Route timeline */}
        <View className="mx-4 mb-3 flex-row items-stretch pl-0.5">
          <View className="w-4 items-center">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.pickup }} />
            <View className="w-px flex-1 bg-slate-700" />
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: colors.destination }}
            />
          </View>
          <View className="ml-3 flex-1 gap-2.5">
            <Text className="text-[13px] font-medium text-slate-400" numberOfLines={1}>
              {ride.pickup?.address ?? 'Pickup location'}
            </Text>
            <Text className="text-[13px] font-medium text-slate-400" numberOfLines={1}>
              {ride.destination?.address ?? 'Dropoff location'}
            </Text>
          </View>
        </View>
        {ride.startedAt && (
          <View className="flex-row items-center justify-end border-t border-gray-100 bg-primary/5 px-4 py-2">
            <View className="flex-row items-center">
              <Feather name="calendar" size={14} color="#9CA3AF" />
              <Text className="ml-1.5 text-xs text-gray-500">
                {format(new Date(ride.startedAt), 'dd MMM yyyy')}
              </Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
