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
import { Link, useRouter } from 'expo-router';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useAuthenticatedQuery } from '@/hooks/customApi';
import { api, Id } from '@tutem/api';
import { useRider } from '@/hooks/useRider';

import {
  Button,
  Card,
  CardContent,
  Separator,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tutem/ui';
import { distanceFormat, formatFare } from '@/lib/utils';
import { HomeScreenHeader } from '@/components/CustomHeader';
import { RideStatusBanner } from '@/components/RideStatusBanner';
import { colors } from '@/constants/colors';
import { FunctionReturnType } from 'convex/server';
import { useState } from 'react';

type CurrentRide = FunctionReturnType<typeof api.routes.rides.getRiderCurrentRideByRiderId>;

// Vehicle Icons
const VEHICLE_ICONS = {
  Cab: 'car',
  Bike: 'bike',
  Auto: 'rickshaw',
} as const;

const services = [
  {
    id: 'ride_request',
    name: 'Ride Request',
    image: require('@/assets/images/ride_request.png'),
    href: '/ride/createRequest',
  },
  {
    id: 'ride_pooling',
    name: 'Ride Pooling',
    image: require('@/assets/images/ride_pooling.png'),
    href: '/',
  },
  {
    id: 'walk_mode',
    name: 'Walk Mode',
    image: require('@/assets/images/walk_mode.png'),
    href: '/',
  },
] as const;

const youtubeVideos = [
  { id: 'theytLvdnaE', title: 'Ride Booking', subtitle: 'Watch quick ride booking insights' },
  { id: '6e7vblkc4eM', title: 'SOS', subtitle: 'Watch quick SOS insights' },
  { id: 'bpDMl2VgqJw', title: 'User Pairing', subtitle: 'Watch quick user pairing insights' },
];

export default function HomeScreen() {
  const { rider: user } = useRider();
  const router = useRouter();

  const [showRideDialog, setShowRideDialog] = useState(false);

  const currentRide = useAuthenticatedQuery(
    api.routes.rides.getRiderCurrentRideByRiderId,
    user && user.riderDetails ? { riderId: user.riderDetails._id } : 'skip'
  );

  const openVideo = async (videoId: string) => {
    const appUrl = `youtube://watch?v=${videoId}`;
    const webUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const supported = await Linking.canOpenURL(appUrl);

    await Linking.openURL(supported ? appUrl : webUrl);
  };

  return (
    <View className="flex-1 bg-background">
      {user && <HomeScreenHeader user={user} />}
      {currentRide && (
        <ActiveRideDialog
          rideId={currentRide._id}
          open={showRideDialog}
          setOpen={(state: boolean) => {
            setShowRideDialog(state);
          }}
        />
      )}

      <ScrollView showsVerticalScrollIndicator={false} className="bg-background">
        <Text className="mx-4 mb-3 text-xl font-bold">Ride Services</Text>
        {/*  Ride Services  */}
        <View className="flex-row gap-2 px-4">
          {services.map((service) => (
            <TouchableOpacity
              key={service.id}
              onPress={() => {
                if (currentRide) return setShowRideDialog(true);
                router.push(service.href);
              }}
              className="aspect-square flex-1 items-center justify-center rounded-xl bg-primary/10 px-2 hover:scale-50">
              {/* Icon container */}
              <Image
                source={service.image}
                style={{ width: '100%', height: 70 }}
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

        {currentRide && <ActiveRideCard currentRide={currentRide} />}

        {/* Insights */}
        <Text className="mx-6 mb-3 text-xl font-bold">Insights</Text>

        <FlatList
          data={youtubeVideos}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 24,
            gap: 14,
          }}
          renderItem={({ item }) => (
            <View className="h-52 w-72 overflow-hidden rounded-2xl bg-primary/10">
              {/* Thumbnail */}
              <ImageBackground
                className="flex-1 items-center justify-center"
                source={{
                  uri: `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`,
                }}>
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
          <Text className="-mb-2 text-center text-lg font-bold tracking-wide">
            Developed for public convenience
          </Text>
          <Text className="text-center text-lg font-bold tracking-wide">No commission charged</Text>
        </View>
        <Image
          source={require('@/assets/images/footer.png')}
          style={{ width: '100%', height: 130 }}
          resizeMode="cover"
        />
      </ScrollView>
    </View>
  );
}

export function ActiveRideCard({ currentRide }: { currentRide: NonNullable<CurrentRide> }) {
  const { vehicle, distance, pickup, destination, fare } = currentRide;

  return (
    <View className="p-4">
      <Text className="mb-3 text-xl font-bold">Active Ride</Text>
      <Card className="rounded-2xl border-2 border-green-500 bg-card shadow-xl">
        <CardContent className="gap-3 p-4">
          {/* Header: Status + OTP */}
          <RideStatusBanner ride={currentRide} className="-m-4 mb-1 rounded-b-none border-0 py-2" />

          {/* Route */}
          <View className="gap-1">
            <View className="flex-row items-center gap-2">
              <MaterialCommunityIcons name="map-marker" size={16} color="green" />
              <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                {pickup.address}
              </Text>
            </View>
            <View className="ml-2 h-4 w-px self-start bg-black/10" />
            <View className="flex-row items-center gap-2">
              <MaterialCommunityIcons name="map-marker" size={16} color="red" />
              <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                {destination.address}
              </Text>
            </View>
          </View>

          <Separator />

          {/* Vehicle + Distance + Fare */}
          <View className="flex-row items-center justify-between gap-1">
            <View className="flex-1 flex-row items-center gap-2">
              {vehicle && (
                <View className="rounded-full bg-primary/15 p-1">
                  <MaterialCommunityIcons
                    name={VEHICLE_ICONS[vehicle.class]}
                    size={24}
                    color={colors.primary}
                  />
                </View>
              )}

              <View className="flex-1 gap-0.5">
                <Text className="font-semibold text-primary">
                  {currentRide.driver.userDetails.firstName}{' '}
                  {currentRide.driver.userDetails.lastName}
                </Text>

                {vehicle && (
                  <Text className="text-sm text-slate-600" ellipsizeMode="tail">
                    {vehicle.model} • {vehicle.color} • {vehicle.registrationNumber}
                  </Text>
                )}
              </View>
            </View>

            <View className="shrink-0 items-end gap-0.5">
              <Text className="text-lg font-extrabold tracking-wider text-green-400">
                {formatFare(fare)}
              </Text>
              <Text className="text-xs text-muted-foreground">{distanceFormat(distance)}</Text>
            </View>
          </View>
        </CardContent>
        <Separator />
        <Link
          href={{
            pathname: '/ride/rideRequest',
            params: { id: currentRide._id },
          }}
          className="rounded-b-2xl bg-primary/10 p-3">
          <Text className="text-center text-sm tracking-wide text-primary">View Details →</Text>
        </Link>
      </Card>
    </View>
  );
}

function ActiveRideDialog({
  rideId,
  open,
  setOpen,
}: {
  rideId: Id<'ride'>;
  open: boolean;
  setOpen: (state: boolean) => void;
}) {
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center font-bold tracking-wider">Ride request</DialogTitle>
          <Separator />
          <DialogDescription className="py-0.5 text-center">
            There's already a ride request active. You can't create another ride request until your
            current ride is completed.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">
              <Text className="font-bold tracking-wider">Close</Text>
            </Button>
          </DialogClose>
          <Button
            className="mb-2"
            onPress={() => {
              setOpen(false);
              router.push({ pathname: '/ride/rideRequest', params: { id: rideId } });
            }}>
            <Text className="font-bold tracking-wider text-white">View Details</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
