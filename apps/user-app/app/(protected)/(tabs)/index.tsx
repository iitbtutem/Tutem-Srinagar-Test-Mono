import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  ImageBackground,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '@tutem/api';
import { useAuth } from '@clerk/expo';

import { Card, CardContent } from '@tutem/ui';
import { distanceFormat, formatFare } from '@/lib/utils';
import { HomeScreenHeader } from '@/components/CustomHeader';

const services = [
  { id: 'ride_request', name: 'Ride Request', image: require('@/assets/images/ride_request.png'), href: '/whereto' },
  { id: 'ride_pooling', name: 'Ride Pooling', image: require('@/assets/images/ride_pooling.png'), href: '/' },
  { id: 'walk_mode', name: 'Walk Mode', image: require('@/assets/images/walk_mode.png'), href: '/' },
] as const;

const youtubeVideos = [
  { id: 'theytLvdnaE', title: "Ride Booking", subtitle: "Watch quick ride booking insights" },
  { id: '6e7vblkc4eM', title: "SOS", subtitle: "Watch quick SOS insights" },
  { id: 'bpDMl2VgqJw', title: "User Pairing", subtitle: "Watch quick user pairing insights" },
];

const getYoutubeThumbnail = (url: string) => {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/watch\?v=)([^?&]+)/
  );

  const videoId = match?.[1];

  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
};

export default function HomeScreen() {
  const { userId } = useAuth();
  const router = useRouter();

  const user = useQuery(api.routes.rider.getRider, userId && userId !== '' ? { clerkId: userId } : 'skip');

  const openVideo = async (videoId: string) => {
    const appUrl = `youtube://watch?v=${videoId}`;
    const webUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const supported = await Linking.canOpenURL(appUrl);

    await Linking.openURL(supported ? appUrl : webUrl);
  };

  return (
    <View className="flex-1 bg-background">

      {user && <HomeScreenHeader user={user} />}

      <ScrollView showsVerticalScrollIndicator={false} className='bg-background'>
        <Text className="mx-6 mb-3 text-xl font-bold">Ride Services</Text>
        {/*  Ride Services  */}
        <View className="flex-row gap-2 px-4">
          {services.map((service) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(service.href)}
              className="aspect-square items-center justify-center flex-1 bg-primary/10 rounded-xl px-2">
              {/* Icon container */}
              <Image
                source={service.image}
                style={{ width: "100%", height: 70 }}
                resizeMode="cover"
              />

            {/* Label with fixed min-height to prevent layout shift */}
            <View className="justify-center">
              <Text className="text-center text-xs font-bold text-foreground">
                {service.name}
              </Text>
            </View>
            </TouchableOpacity>
          ))}
        </View>

        <ActiveRideCard />

        {/* Insights */}
        <Text className="mx-6 mt-4 mb-3 text-xl font-bold">Insights</Text>

        <FlatList
          data={youtubeVideos}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 24,
            gap: 14,
          }}
          renderItem={({item}) => (
            <View className="h-52 w-72 overflow-hidden rounded-2xl bg-primary/10">
              {/* Thumbnail */}
              <ImageBackground 
                className="flex-1 items-center justify-center" 
                source={{
                uri: `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`}}
              >
                <TouchableOpacity onPress={() => openVideo(item.id)}>
                  <MaterialIcons name="play-circle" size={48} color="#fff" />
                </TouchableOpacity>
              </ImageBackground>

              {/* Footer */}
              <View className="p-3 pt-1">
                <Text className="text-sm font-semibold text-foreground">{item.title}</Text>
                <Text className="text-xs text-muted-foreground">{item.subtitle}</Text>
              </View>
            </View>
          )}
        />

        <View className="my-2">
          <Text className="text-lg font-bold text-center tracking-wide -mb-2">Developed for public convenience</Text>
          <Text className="text-lg font-bold text-center tracking-wide">No commission charged</Text>
        </View>
        <Image
          source={require("@/assets/images/footer.png")}
          style={{ width: "100%", height: 130 }}
          resizeMode="cover"
        />
      </ScrollView>
    </View>
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
              {otp && <View className="items-end">
                <Text className="text-xs text-muted-foreground">OTP</Text>
                <Text className="text-lg font-bold tracking-widest text-foreground">{otp}</Text>
              </View>}
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
