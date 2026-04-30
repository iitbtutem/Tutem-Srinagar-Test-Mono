import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '@tutem/api';
import { useAuth } from '@clerk/expo';

import { Card, CardContent } from '@/components/ui/card';
import { distanceFormat, formatFare } from '@/lib/utils';

const IMAGES = {
  ride_pooling: require('@/assets/images/ride_pooling.png'),
  ride_request: require('@/assets/images/ride_request.png'),
  walk_companion: require('@/assets/images/walk_companion.png'),
} as const;

const SERVICES = [
  { id: 'ride_request', name: 'Ride Request', image: 'ride_request', href: '/whereto' },
  { id: 'ride_pooling', name: 'Ride Pooling', image: 'ride_pooling', href: '/' },
  { id: 'walk_companion', name: 'Walk Companion', image: 'walk_companion', href: '/' },
] as const;

export default function HomeScreen() {
  const router = useRouter();

  return (
      <ScrollView showsVerticalScrollIndicator={false} className='bg-background'>
        {/*  Ride Services  */}
        <View className="mt-6 px-6">
          <Text className="mb-4 text-xl font-semibold text-foreground">Ride Services</Text>
          <FlatList
            data={SERVICES}
            keyExtractor={(item) => item.id}
            numColumns={3}
            scrollEnabled={false}
            columnWrapperStyle={{ gap: 14 }}
            contentContainerStyle={{ gap: 14 }}
            renderItem={({ item: service }) => (
              <View className="flex-1 gap-3">
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => router.push(service.href)}
                  className="aspect-square w-full items-center justify-center rounded-full p-3 bg-card shadow-sm">
                  {/* Icon container */}
                  <View className="h-24 w-24 items-center justify-center rounded-full">
                    <Image
                      source={IMAGES[service.image]}
                      style={{ width: 80, height: 80 }}
                      resizeMode="cover"
                    />
                  </View>
                </TouchableOpacity>

                {/* Label with fixed min-height to prevent layout shift */}
                <View className="min-h-[40px] justify-center">
                  <Text className="text-center text-xs font-medium text-foreground">
                    {service.name}
                  </Text>
                </View>
              </View>
            )}
          />
        </View>

        {/* -------- Insights -------- */}
        <View className="mt-8">
          <Text className="mx-6 mb-4 text-xl font-semibold text-foreground">Insights</Text>

          <FlatList
            data={[{ id: 'vid1' }, { id: 'vid2' }, { id: 'vid3' }] as const}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: 24,
              gap: 14,
            }}
            renderItem={() => (
              <View className="h-40 w-64 overflow-hidden rounded-2xl bg-card shadow-sm">
                {/* Thumbnail */}
                <View className="flex-1 items-center justify-center bg-muted/40">
                  <MaterialIcons name="play-circle" size={48} color="#6b7280" />
                </View>

                {/* Footer */}
                <View className="p-3">
                  <Text className="text-sm font-semibold text-foreground">Safety Tips</Text>
                  <Text className="text-xs text-muted-foreground">
                    Watch quick ride safety insights
                  </Text>
                </View>
              </View>
            )}
          />
        </View>

        <ActiveRideCard />

        <View className="h-10" />
      </ScrollView>
  );
}

export function ActiveRideCard() {
  const router = useRouter();

  const { userId } = useAuth();

  const user = useQuery(api.routes.rider.getRider, userId ? { clerkId: userId } : 'skip');

  const currentRide = useQuery(
    api.routes.rides.getRiderCurrentRideByRiderId,
    user && user.riderDetails ? { riderId: user.riderDetails._id } : 'skip'
  );
  if (!currentRide) return null;

  const { rider, vehicle, distance, otp, status, pickup, destination, fare } = currentRide;

  const statusColor: Record<string, string> = {
    accepted: 'bg-blue-100 text-blue-700',
    arrived: 'bg-amber-100 text-amber-700',
    started: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-600',
  };

  return (
    <View className='p-6'>
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: '/rideRequest',
            params: { id: currentRide._id },
          })
        }
        activeOpacity={0.85}>
        <Card className="rounded-2xl border border-border bg-card shadow-sm">
          <CardContent className="gap-3 p-4">
            {/* Header: Status + OTP */}
            <View className="flex-row items-center justify-between">
              <View
                className={`rounded-full px-3 py-1 ${statusColor[status] ?? 'bg-muted dark:bg-gray-300 text-muted-foreground'}`}>
                <Text className="text-xs font-medium capitalize">{status}</Text>
              </View>
              <View className="items-end">
                <Text className="text-xs text-muted-foreground">OTP</Text>
                <Text className="text-lg font-bold tracking-widest text-foreground">{otp}</Text>
              </View>
            </View>

            {/* Route */}
            <View className="gap-1">
              <View className="flex-row items-center gap-2">
                <View className="h-2 w-2 rounded-full bg-green-500" />
                <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                  {pickup?.address ?? 'Pickup'}
                </Text>
              </View>
              <View className="ml-[3px] h-4 w-px self-start bg-border" />
              <View className="flex-row items-center gap-2">
                <View className="h-2 w-2 rounded-full bg-red-500" />
                <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                  {destination?.address ?? 'Dropoff'}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View className="h-px bg-border" />

            {/* Vehicle + Distance + Fare */}
            <View className="flex-row items-center justify-between">
              <View className="gap-0.5">
                {vehicle && (
                  <Text className="text-sm font-medium text-foreground">
                    {vehicle.model}{' '}
                    <Text className="font-normal text-muted-foreground">· {vehicle.color}</Text>
                  </Text>
                )}
                <Text className="text-xs text-muted-foreground">
                  {vehicle?.registrationNumber ?? '—'}
                </Text>
              </View>
              <View className="items-end gap-0.5">
                <Text className="text-sm font-semibold text-foreground">{formatFare(fare)}</Text>
                <Text className="text-xs text-muted-foreground">{distanceFormat(distance)}</Text>
              </View>
            </View>
          </CardContent>
        </Card>
      </TouchableOpacity>
    </View>
  );
}
