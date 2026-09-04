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
import { Button, Text, Avatar, AvatarFallback, AvatarImage } from '@tutem/ui';
import StarRating from './StarRating';
import { distanceFormat, formatFare, cn } from '@/lib/utils';
import { FunctionReturnType } from 'convex/server';
import { api, Id } from '@tutem/api';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { colors } from '@/constants/colors';
import GenderAge from './GenderAge';
import { useEffect, useState } from 'react';
import { useAuthenticatedQuery } from '@/hooks/customApi';

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
  FunctionReturnType<typeof api.routes.rides.getDriverHistory>['page'][number]
>;

type CurrentRide = NonNullable<
  FunctionReturnType<typeof api.routes.rides.getDriverCurrentRideByDriverId>
>;

function getCountdownRemainingSeconds(
  requestedAt: number | undefined,
  driverResponseTimeMinutes: number
): number {
  if (!requestedAt) return Math.max(0, Math.round(driverResponseTimeMinutes * 60));
  const expiryTimestamp = requestedAt + driverResponseTimeMinutes * 60 * 1000;
  return Math.max(0, Math.floor((expiryTimestamp - Date.now()) / 1000));
}

function formatMinutesAndSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function RideCountdownBadge({
  requestedAt,
  driverResponseTimeMinutes = 10,
}: {
  requestedAt: number | undefined;
  driverResponseTimeMinutes?: number;
}) {
  const [remainingSec, setRemainingSec] = useState(() =>
    getCountdownRemainingSeconds(requestedAt, driverResponseTimeMinutes)
  );

  useEffect(() => {
    setRemainingSec(getCountdownRemainingSeconds(requestedAt, driverResponseTimeMinutes));
    const timer = setInterval(() => {
      setRemainingSec(getCountdownRemainingSeconds(requestedAt, driverResponseTimeMinutes));
    }, 1000);
    return () => clearInterval(timer);
  }, [requestedAt, driverResponseTimeMinutes]);

  const isUrgent = remainingSec <= 30;
  const display = formatMinutesAndSeconds(remainingSec);

  return (
    <View
      className={cn(
        'flex-row items-center gap-1 rounded-full border px-2 py-0.5',
        isUrgent ? 'border-red-500/50 bg-red-500/15' : 'border-primary/10 bg-primary/5'
      )}>
      <Feather name="clock" size={11} color={isUrgent ? '#ef4444' : '#40a4f5'} />
      <Text
        className={cn(
          'text-xs font-extrabold tabular-nums tracking-tight',
          isUrgent ? 'text-red-400' : 'text-primary'
        )}>
        {display}
      </Text>
    </View>
  );
}

export function RideRequestCard({
  ride,
  handleAccept,
  handleReject,
  acceptCheck,
  onViewRiderImage,
  driverResponseTime: propDriverResponseTime,
}: {
  ride: RideRequest;
  handleAccept: (rideId: Id<'ride'>) => void;
  handleReject: (rideId: Id<'ride'>) => void;
  acceptCheck: { ok: boolean; reason?: string };
  onViewRiderImage?: (uri?: string | null, name?: string) => void;
  driverResponseTime?: number;
}) {
  const settings = useAuthenticatedQuery(
    api.routes.settings.rideSettings,
    propDriverResponseTime !== undefined ? 'skip' : {}
  );
  const driverResponseTime = propDriverResponseTime ?? settings?.driverResponseTime ?? 10;

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const riderName =
    `${ride.rider.details.firstName ?? ''} ${ride.rider.details.lastName ?? ''}`.trim() ||
    'Passenger';
  const riderProfilePicture = ride.rider.details.profilePictureKey;

  return (
    <Animated.View entering={FadeInDown.delay(200)} style={animStyle} className="mb-3">
      <View className="overflow-hidden rounded-2xl border border-primary bg-background px-4 py-3">
        {/* Header */}
        <View className="flex-row items-start justify-between">
          <View className="flex-1 flex-row items-center gap-3">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onViewRiderImage?.(riderProfilePicture, riderName)}>
              <Avatar alt="Rider pic" className="h-11 w-11">
                <AvatarImage
                  source={
                    riderProfilePicture?.trim()
                      ? { uri: riderProfilePicture }
                      : require('@/assets/images/avatar.jpg')
                  }
                />
                <AvatarFallback className="bg-white/20">
                  <Text className="text-xs font-bold text-primary">
                    {ride.rider.details.firstName?.[0]}
                    {ride.rider.details.lastName?.[0]}
                  </Text>
                </AvatarFallback>
              </Avatar>
            </TouchableOpacity>

            <View className="flex-1">
              <Text className="text-title mb-0.5 text-base font-bold" numberOfLines={1}>
                {riderName}
              </Text>
              <View className="flex-row gap-1">
                <GenderAge gender={ride.rider.details.gender} dob={ride.rider.details.dob} />
                <StarRating rating={ride.rider.ratings} />
              </View>
            </View>
          </View>
          <View className="items-end gap-1">
            <Text className="text-xl font-extrabold tracking-tight text-emerald-400">
              {formatFare(ride.fare)}
            </Text>
            {ride.requestStatus === 'Pending' && (
              <RideCountdownBadge
                requestedAt={ride.requestedAt}
                driverResponseTimeMinutes={driverResponseTime}
              />
            )}
          </View>
        </View>

        {/* Route timeline */}
        <View className="my-1.5 flex-row items-stretch pl-0.5">
          <View className="w-4 items-center">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.pickup }} />
            <View className="w-px flex-1 bg-slate-700" />
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: colors.destination }}
            />
          </View>
          <View className="ml-3 flex-1 gap-1">
            <Text className="text-[13px] font-medium text-slate-400" numberOfLines={1}>
              {ride.pickup?.address ?? 'Pickup location'}
            </Text>

            <View className="flex-row gap-3">
              <Text className="text-xs font-semibold text-slate-400">
                📍 {distanceFormat(ride.distance) ?? '-'}
              </Text>
              {ride.expectedDuration && (
                <Text className="text-xs font-semibold text-slate-400">
                  ⏱ {ride.expectedDuration}
                </Text>
              )}
            </View>

            <Text className="text-[13px] font-medium text-slate-400" numberOfLines={1}>
              {ride.destination?.address ?? 'Dropoff location'}
            </Text>
          </View>
        </View>

        <View className="mt-1.5 flex-row gap-3">
          <Button
            size="sm"
            className="flex-1 items-center justify-center rounded-2xl border-2 border-red-500/40 bg-red-500/10"
            onPress={() => handleReject(ride._id)}>
            <Text className="text-[15px] font-extrabold text-red-400">✕ Decline</Text>
          </Button>
          <Button
            size="sm"
            className={`flex-1 items-center justify-center rounded-2xl border-2 border-green-500 bg-green-600 ${!acceptCheck.ok ? 'opacity-30' : 'opacity-100'}`}
            onPress={() => handleAccept(ride._id)}
            disabled={!acceptCheck.ok}>
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
              {`${ride.rider?.userDetails?.firstName ?? ''} ${ride.rider?.userDetails?.lastName ?? ''}`.trim() ||
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

export function CurrentRideCard({
  ride,
  onPress,
  onViewRiderImage,
  driverResponseTime: propDriverResponseTime,
}: {
  ride: CurrentRide;
  onPress: () => void;
  onViewRiderImage?: (uri?: string | null, name?: string) => void;
  driverResponseTime?: number;
}) {
  const settings = useAuthenticatedQuery(
    api.routes.settings.rideSettings,
    propDriverResponseTime !== undefined ? 'skip' : {}
  );
  const driverResponseTime = propDriverResponseTime ?? settings?.driverResponseTime ?? 10;

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const riderName =
    `${ride.rider.details.firstName ?? ''} ${ride.rider.details.lastName ?? ''}`.trim() ||
    'Passenger';
  const riderProfilePicture = ride.rider.details.profilePictureKey;

  return (
    <Animated.View entering={FadeInDown.delay(200)} style={animStyle} className="mb-3 w-full">
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 40 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 30 });
        }}
        onPress={onPress}
        className="overflow-hidden rounded-xl border-2 border-primary bg-card p-4 shadow-sm">
        <View className="flex-row items-center justify-between border-b border-slate-950 pb-2">
          <Text className="font-bold text-primary">Current Ride</Text>
          <View className="flex-row items-center gap-2">
            {ride.requestStatus === 'Pending' && (
              <RideCountdownBadge
                requestedAt={ride.requestedAt}
                driverResponseTimeMinutes={driverResponseTime}
              />
            )}
            <View className="rounded-full bg-primary px-4 py-1">
              <Text className="text-[10px] font-black uppercase text-white">
                {ride.status === 'Open' ? ride.requestStatus : ride.status}
              </Text>
            </View>
          </View>
        </View>
        {/* Header */}
        <View className="mb-3 mt-2 flex-row items-start justify-between">
          <View className="flex-1 flex-row items-center gap-3">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onViewRiderImage?.(riderProfilePicture, riderName)}>
              <Avatar alt="Rider pic" className="h-11 w-11">
                <AvatarImage
                  source={
                    riderProfilePicture?.trim()
                      ? { uri: riderProfilePicture }
                      : require('@/assets/images/avatar.jpg')
                  }
                />
                <AvatarFallback className="bg-white/20">
                  <Text className="text-xs font-bold text-primary">
                    {ride.rider.details.firstName?.[0]}
                    {ride.rider.details.lastName?.[0]}
                  </Text>
                </AvatarFallback>
              </Avatar>
            </TouchableOpacity>

            <View className="flex-1">
              <Text className="text-title mb-0.5 text-base font-bold" numberOfLines={1}>
                {riderName}
              </Text>
              <View className="flex-row gap-1">
                <GenderAge gender={ride.rider.details.gender} dob={ride.rider.details.dob} />
                <StarRating rating={ride.rider.ratings} />
              </View>
            </View>
          </View>
          <Text className="text-xl font-extrabold tracking-tight text-emerald-400">
            {formatFare(ride.fare)}
          </Text>
        </View>

        {/* Route timeline */}
        <View className="mb-3 flex-row items-stretch pl-0.5">
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

            <View className="flex-row gap-3">
              <Text className="text-xs font-semibold text-slate-400">
                📍 {distanceFormat(ride.distance) ?? '-'}
              </Text>
              {ride.expectedDuration && (
                <Text className="text-xs font-semibold text-slate-400">
                  ⏱ {ride.expectedDuration}
                </Text>
              )}
            </View>

            <Text className="text-[13px] font-medium text-slate-400" numberOfLines={1}>
              {ride.destination?.address ?? 'Dropoff location'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
