import { useLocalSearchParams, Stack, router } from 'expo-router';
import { useQuery } from 'convex/react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { ScrollView, View, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MapPin, Clock, DollarSign, Star, Phone, Gauge } from 'lucide-react-native';
import { api, Id } from '@tutem/api';
import ErrorScreen from '@/components/ErrorScreen';
import { distanceFormat, getTimeBetweenFormatted, formatFare } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage, Button, Loader, Separator } from '@tutem/ui';
import { FunctionReturnType } from 'convex/server';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GenderAge } from '@tutem/ui';
import { BasicHeader } from '@/components/CustomHeader';
import { colors } from '@/constants/colors';

type Ride = NonNullable<FunctionReturnType<typeof api.routes.rides.getRiderRide>>;

// helpers

function formatTs(ts?: number) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// status pill

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  Open: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  Active: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Driver Arrived': { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  Abort: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  Completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  Canceled: { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' },
};

function StatusPill({
  label,
  styles,
}: {
  label: string;
  styles: { bg: string; text: string; dot?: string };
}) {
  return (
    <View className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${styles.bg}`}>
      {styles.dot && <View className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />}
      <Text className={`text-xs font-semibold tracking-wide ${styles.text}`}>{label}</Text>
    </View>
  );
}

// section header

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="mb-3 mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">
      {title}
    </Text>
  );
}

// person card

function RiderCard({ driver, extra }: { driver: Ride['driver']; extra?: React.ReactNode }) {
  const { details, ratings } = driver;
  const fullName = [details.firstName, details.lastName].filter(Boolean).join(' ');
  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <Text className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
        Driver
      </Text>
      <View className="flex-row items-center gap-3">
        <Avatar alt="Profile pic" className="h-12 w-12">
          <AvatarImage
            source={
              details.profilePictureKey?.trim()
                ? { uri: details.profilePictureKey }
                : require('@/assets/images/avatar.jpg')
            }
          />
          <AvatarFallback className="bg-white/20">
            <Text className="text-sm font-bold text-primary">
              {details.firstName?.[0]}
              {details.lastName?.[0]}
            </Text>
          </AvatarFallback>
        </Avatar>
        <View className="flex-1">
          <Text className="text-base font-semibold text-slate-900">{fullName}</Text>
          <View className="mt-0.5">
            <GenderAge gender={details.gender} dob={details.dob} />
          </View>
        </View>
        {ratings.average !== null && (
          <View className="items-center rounded-xl bg-amber-50 px-2.5 py-1.5">
            <View className="flex-row items-center gap-1">
              <Star size={11} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-sm font-bold text-amber-600">{ratings.average.toFixed(1)}</Text>
            </View>
            <Text className="mt-0.5 text-xs text-slate-400">{ratings.totalRatings} ratings</Text>
          </View>
        )}
      </View>
      {extra}
    </View>
  );
}

// route card

function RouteCard({ ride }: { ride: Ride }) {
  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <SectionHeader title="Route" />
      {/* Pickup */}
      <View className="flex-row items-start gap-3">
        <View className="items-center" style={{ width: 22 }}>
          <View className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: colors.pickup }} />
          <View className="my-1 w-0.5 flex-1 bg-slate-200" style={{ minHeight: 24 }} />
        </View>
        <View className="flex-1 pb-2">
          <Text className="mb-0.5 text-xs" style={{ color: colors.pickup }}>
            Pickup
          </Text>
          <Text className="text-sm font-medium leading-snug text-slate-800">
            {ride.pickup.address}
          </Text>
        </View>
      </View>

      {/* if ride was aborted halfway */}
      {ride.status === 'Abort' && ride.dropOff && (
        <View className="flex-row items-start gap-3">
          <View className="items-center" style={{ width: 22 }}>
            <MaterialCommunityIcons
              name="map-marker-minus-outline"
              size={14}
              color={colors.destination}
            />
          </View>
          <View className="flex-1">
            <Text className="mb-0.5 text-xs" style={{ color: '#f97316' }}>
              Drop Off
            </Text>
            <Text className="text-sm font-medium leading-snug text-slate-800">
              {ride.destination.address}
            </Text>
          </View>
        </View>
      )}

      {/* Destination */}
      <View className="flex-row items-start gap-3">
        <View className="items-center" style={{ width: 22 }}>
          <MapPin
            size={14}
            color={ride.status === 'Abort' ? '#9CA3AF' : colors.destination}
            strokeWidth={2.2}
          />
        </View>
        <View className="flex-1">
          <Text className="mb-0.5 text-xs" style={{ color: colors.destination }}>
            Destination
          </Text>
          <Text className="text-sm font-medium leading-snug text-slate-800">
            {ride.destination.address}
          </Text>
        </View>
      </View>

      {/* if ride was exceeded destination */}
      {ride.status === 'Completed' && ride.dropOff && (
        <View className="flex-row items-start gap-3">
          <View className="items-center" style={{ width: 22 }}>
            <MaterialCommunityIcons name="map-marker-plus-outline" size={14} color="#e11d48" />
          </View>
          <View className="flex-1">
            <Text className="mb-0.5 text-xs text-slate-400">Drop Off</Text>
            <Text className="text-sm font-medium leading-snug text-slate-800">
              {ride.destination.address}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// timeline

function Timeline({ ride }: { ride: Ride }) {
  const abortRideReason = ride.rideReasons.find(
    (reason) => reason.driverId === ride.driverId || reason.driverId === undefined
  );
  const steps = [
    { status: 'Requested', ts: ride.requestedAt, done: true },
    { status: 'Accepted', ts: ride.acceptedAt, done: !!ride.acceptedAt },
    { status: 'Driver Arrived', ts: ride.arrivedAt, done: !!ride.arrivedAt },
    { status: 'Started', ts: ride.startedAt, done: !!ride.startedAt },
    ...(abortRideReason
      ? [{ status: 'Abort', ts: abortRideReason._creationTime, done: true }]
      : []),
    { status: 'Completed', ts: ride.completedAt, done: !!ride.completedAt },
  ];
  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <SectionHeader title="Timeline" />
      {steps.map((step, i) => (
        <View key={step.status} className="flex-row items-start gap-3">
          <View className="items-center" style={{ width: 18 }}>
            <View
              className={`mt-1 h-2.5 w-2.5 rounded-full ${step.done ? 'bg-indigo-500' : 'bg-slate-200'}`}
            />
            {i < steps.length - 1 && (
              <View
                className={`my-1 w-0.5 flex-1 ${step.done && steps[i + 1].done ? 'bg-indigo-200' : 'bg-slate-100'}`}
                style={{ minHeight: 18 }}
              />
            )}
          </View>
          <View className="flex-1 pb-2">
            <Text
              className={`text-sm font-medium ${step.done ? 'text-slate-800' : 'text-slate-300'}`}>
              {step.status}
            </Text>
            {step.ts && <Text className="mt-0.5 text-xs text-slate-400">{formatTs(step.ts)}</Text>}
          </View>
        </View>
      ))}
      {abortRideReason && (
        <View className="mt-4 rounded-3xl border border-destructive/30 bg-destructive/5 p-4">
          <View className="mb-3 gap-2">
            <Text className="text-xs font-medium uppercase tracking-wider text-destructive">
              Ride Aborted
            </Text>

            <View className="max-w-full self-start rounded-full bg-destructive/15 px-3 py-1">
              <Text numberOfLines={2} className="text-xs font-semibold text-primary">
                {abortRideReason.driverId
                  ? `Aborted by ${ride.driver.details.firstName} ${ride.driver.details.lastName}`
                  : 'Aborted by You'}
              </Text>
            </View>
          </View>

          <View className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-5">
            <Text className="text-center text-base font-semibold leading-6 text-destructive">
              {abortRideReason.reason}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ratings section

function RatingsSection({ ratings }: { ratings: Ride['ratings'] }) {
  if (!ratings?.length) return null;
  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <SectionHeader title="Ratings" />
      <View className="gap-3">
        {ratings.map((rating) => (
          <View key={rating._id} className="rounded-xl bg-slate-50 p-3">
            {rating.raterType === 'Rider' ? (
              <View className="mb-1 flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <View className="rounded-full bg-emerald-100 px-2 py-0.5">
                    <Text className="text-xs font-semibold text-emerald-700">You</Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      color={i < rating.score ? '#f59e0b' : '#e2e8f0'}
                      fill={i < rating.score ? '#f59e0b' : '#e2e8f0'}
                    />
                  ))}
                  <Text className="ml-1 text-xs font-bold text-slate-600">{rating.score}/5</Text>
                </View>
              </View>
            ) : (
              <View className="mb-1 flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <View className="rounded-full bg-indigo-100 px-2 py-0.5">
                    <Text className="text-xs font-semibold text-indigo-700">Driver</Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      color={i < rating.score ? '#f59e0b' : '#e2e8f0'}
                      fill={i < rating.score ? '#f59e0b' : '#e2e8f0'}
                    />
                  ))}
                  <Text className="ml-1 text-xs font-bold text-slate-600">{rating.score}/5</Text>
                </View>
              </View>
            )}
            {rating.comment && (
              <Text className="mt-1 text-sm leading-snug text-slate-600">{rating.comment}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

// main screen

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: Id<'ride'> }>();
  const { sessionToken } = useAuthUser();

  const ride = useQuery(
    api.routes.rides.getRiderRide,
    id && sessionToken ? { id, sessionToken } : 'skip'
  );

  if (ride === undefined) {
    return (
      <View className="flex-1 bg-background">
        <Loader subtitle="Loading ride details..." />
      </View>
    );
  }

  if (ride === null) return <ErrorScreen message="Ride not found" code="404" />;

  const rideStatus = STATUS_STYLES[ride.status];

  const showFeedbackBtn = ride.ratings.find((el) => el.raterType === 'Rider');

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Ride Details',
          header: (props) => <BasicHeader {...props} />,
        }}
      />

      <ScrollView
        className="flex-1 bg-slate-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        showsVerticalScrollIndicator={false}>
        {/*  header  */}
        <Animated.View entering={FadeInDown.duration(400).springify()} className="gap-3">
          {/* ride id + status row */}
          <View className="flex-row items-start justify-between gap-2">
            <View className="items-end gap-1.5">
              <StatusPill label={ride.status} styles={rideStatus} />
            </View>
          </View>

          {/* fare + distance + duration */}
          <View className="flex-row gap-3">
            <View className="flex-1 items-center rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
              <DollarSign size={16} color="#6366f1" strokeWidth={2.2} />
              <Text className="mt-1 text-lg font-bold text-slate-900">{formatFare(ride.fare)}</Text>
              <Text className="text-xs text-slate-400">Fare</Text>
            </View>
            <View className="flex-1 items-center rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
              <Gauge size={16} color="#6366f1" strokeWidth={2.2} />
              <Text className="mt-1 text-lg font-bold text-slate-900">
                {distanceFormat(ride.distance)}
              </Text>
              <Text className="text-xs text-slate-400">Distance</Text>
            </View>
            <View className="flex-1 items-center rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
              <Clock size={16} color="#6366f1" strokeWidth={2.2} />
              <Text className="mt-1 text-lg font-bold text-slate-900">
                {ride.status === 'Completed' && ride.startedAt && ride.completedAt
                  ? getTimeBetweenFormatted(new Date(ride.startedAt), new Date(ride.completedAt))
                  : ride.status === 'Abort' && ride.startedAt && ride.updatedAt
                    ? getTimeBetweenFormatted(new Date(ride.startedAt), new Date(ride.updatedAt))
                    : ride.expectedDuration}
              </Text>
              <Text className="text-xs text-slate-400">Duration</Text>
            </View>
          </View>
        </Animated.View>

        <Separator className="my-1 bg-slate-100" />

        {/* route */}
        <Animated.View entering={FadeInDown.delay(60).duration(400).springify()}>
          <RouteCard ride={ride} />
        </Animated.View>

        {/* Driver */}
        <Animated.View entering={FadeInDown.delay(180).duration(400).springify()}>
          <RiderCard
            driver={ride.driver}
            extra={
              <View className="mt-3 flex-row flex-wrap gap-2">
                <View
                  className={`rounded-full px-2.5 py-1 ${
                    ride.driver.isLicenseVerified === 'Verified'
                      ? 'bg-green-100'
                      : ride.driver.isLicenseVerified === 'Rejected'
                        ? 'bg-red-100'
                        : 'bg-yellow-100'
                  }`}>
                  <Text
                    className={`text-xs font-semibold ${
                      ride.driver.isLicenseVerified === 'Verified'
                        ? 'text-green-700'
                        : ride.driver.isLicenseVerified === 'Rejected'
                          ? 'text-red-700'
                          : 'text-yellow-700'
                    }`}>
                    {ride.driver.isLicenseVerified === 'Verified'
                      ? 'Verified License'
                      : `License Verification: ${ride.driver.isLicenseVerified}`}
                  </Text>
                </View>
              </View>
            }
          />
        </Animated.View>

        {/*  timeline  */}
        <Animated.View entering={FadeInDown.delay(240).duration(400).springify()}>
          <Timeline ride={ride} />
        </Animated.View>

        {/*  ratings  */}
        {ride.ratings?.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(400).springify()}>
            <RatingsSection ratings={ride.ratings} />
          </Animated.View>
        )}
        {!showFeedbackBtn && (
          <>
            <Button
              onPress={() => router.push(`/ride/feedback?rideId=${ride._id}`)}
              className="w-full rounded-xl">
              <View className="flex-row items-center justify-center gap-2 py-1">
                <MaterialCommunityIcons name="pencil" size={18} color="white" />
                <Text className="text-base font-semibold text-white">Give Feedback</Text>
              </View>
            </Button>

            <Text className="text-center text-sm text-gray-500">
              You haven't submitted feedback for this ride yet.
            </Text>
          </>
        )}
      </ScrollView>
    </>
  );
}
