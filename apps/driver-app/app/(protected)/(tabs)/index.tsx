import { Text } from '@/components/ui/text';
import { useAuth } from '@clerk/expo';
import { api, Id } from '@tutem/api';
import { useQuery, useAction } from 'convex/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { FunctionReturnType } from 'convex/server';
import { useColorScheme } from 'nativewind';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/CustomToast';
import { Link, Redirect } from 'expo-router';
import { mapStyle } from '../../../../user-app/constants/mapStyles';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import StarRating from '@/components/StarRating';
import { cn, distanceFormat, formatFare, getAge, isNearby } from '@/lib/utils';
import { RideRequestCard as RideCard } from '@/components/RideCard';
import { getDriverChannel, getGlobalChannel } from '@/lib/ably';
import { startLocationTracking, stopLocationTracking } from '@/lib/locationService';
import useThemeColors from '@/hooks/useColorScheme';
import DriverMarker from '@/components/DriverMarker';
import { useDriverLiveLocation } from '@/hooks/useDriverLiveLocation';

// Types

type RideRequest = NonNullable<FunctionReturnType<typeof api.routes.rides.getRideRequests>[number]>;
type Driver = NonNullable<FunctionReturnType<typeof api.routes.driver.getUser>>;

type Cords = { latitude: number; longitude: number };

type RouteState = {
  polyline: Cords[];
  remainingDistance: {
    text: string;
    value: number;
  };
  remainingDuration?: string;
};

// Constants

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Map takes ~62% of screen height in the scrollable layout
const MAP_HEIGHT = Math.round(SCREEN_HEIGHT * 0.42);

// Height of the ride requests list panel
const LIST_PANEL_HEIGHT = Math.round(SCREEN_HEIGHT * 0.45);

// Route Legend

function RouteLegend({ labelA, labelB }: { labelA: string; labelB: string }) {
  return (
    <View className="gap-1.5 rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2">
      <View className="flex-row items-center gap-2">
        <View className="h-1 w-4 rounded-full bg-green-600" />
        <Text className="text-[10px] font-semibold text-slate-400">{labelA}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <View className="h-1 w-4 rounded-full bg-red-600" />
        <Text className="text-[10px] font-semibold text-slate-400">{labelB}</Text>
      </View>
    </View>
  );
}

// Sheet Section

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="mb-2.5 text-[10px] font-bold uppercase tracking-[1.5px] text-slate-600">
        {title}
      </Text>
      {children}
    </View>
  );
}

// Main Screen
export default function Home() {
  const { userId, getToken } = useAuth();

  const driver = useQuery(api.routes.driver.getUser, { clerkId: userId ?? '' });

  const currentRide = useQuery(
    api.routes.rides.getDriverCurrentRideByDriverId,
    driver?.driverDetails ? { driverId: driver.driverDetails._id } : 'skip'
  );

  const driverDetails = driver?.driverDetails;

  // Start / stop background location foreground service whenever the
  // driver toggles online / offline via the Convex isAvailableForRide flag.
  useEffect(() => {
    stopLocationTracking();
    if (!driverDetails) return;

    if ((driverDetails.isAvailableForRide && driverDetails.isOnline) || currentRide) {
      // Fetch a fresh Clerk token and pass real credentials so the headless
      // background task publishes to the correct driver Ably channel.
      getToken().then((authToken) => {
        console.log('started location tracking..');
        startLocationTracking(authToken ? { driverId: driverDetails._id, authToken } : undefined);
      });
    } else {
      console.log('stopped location tracking');
      stopLocationTracking();
    }
  }, [driverDetails?._id, driverDetails?.isAvailableForRide, !!currentRide]);

  // Live GPS
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // Fetch initial position immediately
      try {
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const coords = {
          latitude: initialLoc.coords.latitude,
          longitude: initialLoc.coords.longitude,
        };

        // Publish initial location if online
        if (
          (driverDetails?._id && driverDetails.isAvailableForRide && driverDetails.isOnline) ||
          (currentRide && driverDetails)
        ) {
          const channel = getDriverChannel(driverDetails._id);
          if (channel) {
            channel
              .publish('location', {
                ...coords,
                heading: initialLoc.coords.heading,
                speed: initialLoc.coords.speed,
                timestamp: initialLoc.timestamp,
              })
              .catch((e) => console.error('Ably initial publish error:', e));
          }
        }
      } catch (err) {
        console.error('Failed to get initial location:', err);
      }

      // Presence handling for nearby search discovery
      const globalChannel = getGlobalChannel();

      const updatePresence = async (lat: number, lng: number) => {
        if (
          driverDetails &&
          driverDetails.isAvailableForRide &&
          driverDetails.isOnline &&
          !currentRide
        ) {
          console.log('updating presence to global Channel');
          try {
            await globalChannel?.presence.update({
              driverId: driverDetails._id,
              latitude: lat,
              longitude: lng,
              vehicleClass: driver?.driverDetails?.isLicenseVerified ? 'verified' : 'Not Verified', // Example metadata
              lastUpdated: Date.now(),
            });
          } catch (e) {
            console.error('Ably presence update error:', e);
          }
        } else if (globalChannel) {
          // If not available or on a ride, leave the global discovery channel
          globalChannel.presence.leave().catch(() => {});
          // console.log('leaving ...');
        }
      };

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 0 },
        (loc) => {
          const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          
          updatePresence(coords.latitude, coords.longitude);

          // Publish to Ably if online or on a ride
          if (driverDetails?._id && (driverDetails.isAvailableForRide || currentRide)) {
            const channel = getDriverChannel(driverDetails._id);
            if (channel) {
              channel
                .publish('location', {
                  ...coords,
                  heading: loc.coords.heading,
                  speed: loc.coords.speed,
                  timestamp: loc.timestamp,
                })
                .catch((err) => {
                  console.error('Ably publish error:', err);
                });
            }
          }
        }
      );

      // Also publish at a regular interval (every 10s) to satisfy "constant update" requirement
      const intervalId = setInterval(async () => {
        if (driverDetails?._id && (driverDetails.isAvailableForRide || currentRide)) {
          try {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            const coords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };

            updatePresence(coords.latitude, coords.longitude);

            const channel = getDriverChannel(driverDetails._id);
            if (channel) {
              console.log('Publishing regular 10s location heartbeat...');
              channel
                .publish('location', {
                  ...coords,
                  heading: loc.coords.heading,
                  speed: loc.coords.speed,
                  timestamp: loc.timestamp,
                })
                .catch((e) => console.error('Ably heartbeat error:', e));
            }
          } catch (e) {
            console.error('Failed to get location for heartbeat:', e);
          }
        }
      }, 10 * 1000); // 10 seconds

      // Initial presence entry
      if (driverDetails?._id && driverDetails.isAvailableForRide && !currentRide) {
        globalChannel?.presence
          .enter({
            driverId: driverDetails._id,
            // Use current driverLocation if we have it, otherwise wait for next update
          })
          .catch(() => {});
      }

      return () => {
        sub?.remove();
        clearInterval(intervalId);
        globalChannel?.presence.leave().catch(() => {});
      };
    })();
  }, [driverDetails?._id, driverDetails?.isAvailableForRide, !!currentRide]);

  if (driver === undefined || currentRide === undefined)
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text className="mt-3 text-sm font-medium text-slate-400">Loading…</Text>
      </View>
    );
  if (driver === null) return <Redirect href={'/register'} />;
  if (driver.driverDetails === null) return <Redirect href={'/registerAsDriver'} />;
  if(currentRide !== null) return <Redirect href={{pathname: "/ride/current", params: { id: currentRide._id, driverId: driver.driverDetails._id }}} />

  return <RideRequests driver={driver} />;
}

export const RideRequests = memo(({ driver }: { driver: Driver }) => {
  const { showToast } = useToast();
  const { BottomSheetBackgroundColor, BottomSheetIndicatorColor } = useThemeColors();
  const driverLocation = useDriverLiveLocation();

  const vehicle = useQuery(
    api.routes.vehicle.getVehicleByDriverId,
    driver.driverDetails ? { driverId: driver.driverDetails._id } : 'skip'
  );

  const rideRequests = useQuery(
    api.routes.rides.getRideRequests,
    driver.driverDetails ? { driverId: driver.driverDetails._id } : 'skip'
  );
  const acceptRide = useAction(api.actions.ride.acceptRideAction);
  const rejectRide = useAction(api.actions.ride.rejectRide);

  // Map & location
  const mapRef = useRef<MapView>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // UI state
  const [selectedRide, setSelectedRide] = useState<RideRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(null);

  // Bottom sheet refs
  const requestSheetRef = useRef<BottomSheet>(null);

  const { colorScheme: currentTheme } = useColorScheme();
  const isDark = currentTheme === 'dark';

  // Derived state
  const isLoading = rideRequests === undefined;
  const rides = (rideRequests ?? []) as RideRequest[];
  const hasRides = rides.length > 0;

  // Fit map to relevant points
  const fitMap = useCallback(
    (extra?: Cords[]) => {
      const coords: Cords[] = [];
      if (driverLocation) coords.push(driverLocation);
      if (extra) coords.push(...extra);
      if (coords.length === 0) return;
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
        animated: true,
      });
    },
    [driverLocation]
  );

  useEffect(() => {
    if (driverLocation) {
      mapRef.current?.animateToRegion(
        {
          ...driverLocation,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        1000
      );
    }
  }, [driverLocation]);

  // Select a ride request → fetch preview route
  const handleSelectRide = useCallback(
    async (ride: RideRequest) => {
      setSelectedRide(ride);
      requestSheetRef.current?.snapToIndex(1);

      if (!driverLocation) return;

      const pickupCords = { latitude: ride.pickup.latitude, longitude: ride.pickup.longitude };
      const destCords = {
        latitude: ride.destination.latitude,
        longitude: ride.destination.longitude,
      };
      fitMap([pickupCords, destCords]);
    },
    [driverLocation, fitMap]
  );

  // Deselect ride → clear preview route
  const handleDeselectRide = useCallback(() => {
    setSelectedRide(null);
    requestSheetRef.current?.close();
    if (driverLocation) {
      mapRef.current?.animateToRegion(
        {
          ...driverLocation,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        400
      );
    }
  }, [driverLocation]);

  // Accept / Reject
  const canAcceptRide = useCallback(
    (_ride: RideRequest): { ok: boolean; reason?: string } => {
      if (!driver?.driverDetails?.isAvailableForRide || !driver.driverDetails.isOnline)
        return { ok: false, reason: 'You must be online to accept rides' };
      return { ok: true };
    },
    [driver]
  );

  const handleAccept = async () => {
    if (!selectedRide || !driver?.driverDetails) return;
    const { ok, reason } = canAcceptRide(selectedRide);
    if (!ok) {
      showToast({ title: 'Attention!', description: reason, type: 'info' });
      return;
    }
    setActionLoading('accept');
    try {
      await acceptRide({ driverId: driver.driverDetails._id, rideId: selectedRide._id });
      showToast({
        title: 'Ride Accepted',
        description: 'Ride accepted successfully',
        type: 'success',
      });
      handleDeselectRide();
    } catch (e) {
      console.error(e);
      showToast({ title: 'Failed', description: 'Failed to accept ride', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedRide || !driver?.driverDetails) return;
    setActionLoading('reject');
    try {
      await rejectRide({ driverId: driver.driverDetails._id, rideId: selectedRide._id });
      showToast({ title: 'Ride Rejected', description: 'Ride rejected', type: 'success' });
      handleDeselectRide();
    } catch (e) {
      console.error(e);
      showToast({ title: 'Failed', description: 'Failed to reject ride', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const acceptCheck = selectedRide ? canAcceptRide(selectedRide) : { ok: false, reason: undefined };

  // Selected ride coords
  const selectedPickup = selectedRide
    ? { latitude: selectedRide.pickup.latitude, longitude: selectedRide.pickup.longitude }
    : null;
  const selectedDest = selectedRide
    ? { latitude: selectedRide.destination.latitude, longitude: selectedRide.destination.longitude }
    : null;
  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        contentContainerStyle={{ flexGrow: 1 }}>
        {/* MAP BLOCK - fixed height when rides exist, taller when no rides */}
        <View style={{ height: hasRides ? MAP_HEIGHT : SCREEN_HEIGHT * 0.6 }} className="relative">
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            customMapStyle={isDark ? mapStyle.dark : []}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={false}
            toolbarEnabled={false}
            initialRegion={
              driverLocation
                ? { ...driverLocation, latitudeDelta: 0.04, longitudeDelta: 0.04 }
                : {
                    latitude: 28.6139,
                    longitude: 77.209,
                    latitudeDelta: 0.04,
                    longitudeDelta: 0.04,
                  }
            }>
            {/* Driver marker */}
            {driverLocation && vehicle && (
              <DriverMarker location={driverLocation} vehicleClass={vehicle?.class} />
            )}
            {selectedPickup && (
              <Marker coordinate={selectedPickup} anchor={{ x: 0, y: 0.9 }} pinColor="green" />
            )}
            {selectedDest && (
              <Marker coordinate={selectedDest} anchor={{ x: 0, y: 0.9 }} pinColor="red" />
            )}
          </MapView>

          {/* Map overlay controls — pinned inside the map block */}
          <View
            style={{ position: 'absolute', top: 10, left: 10, right: 10 }}
            className="flex-row items-start justify-between"
            pointerEvents="box-none">
            <View pointerEvents="none">
              <Animated.View entering={FadeInUp.springify()}>
                <RouteLegend labelA={'Pickup'} labelB={'Destination'} />
              </Animated.View>
            </View>
            <TouchableOpacity
              onPress={() => fitMap([selectedPickup, selectedDest].filter(Boolean) as Cords[])}
              activeOpacity={0.8}
              style={{ elevation: 5 }}
              className="h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white shadow-lg">
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={24}
                color={isDark ? '#60a5fa' : '#1a73e8'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Ride requests list - takes remaining space when rides exist */}
        {!vehicle ? (
          <View className="flex-1 items-center justify-center gap-2 rounded-t-2xl border-2 border-red-600 px-6">
            <Text className="font-bold text-destructive">
              {' '}
              You haven't registered your vehicle yet.
            </Text>
            <Link href={'/createVehicle'} asChild>
              <Button className="w-full">
                <Text>Register Now</Text>
              </Button>
            </Link>
          </View>
        ) : (
          <View className={`flex-1 px-4 ${hasRides ? 'pt-4' : 'pt-0'}`}>
            {/* Section header */}
            <View className={`${hasRides ? 'mb-3' : 'mb-2'} flex-row items-center justify-between`}>
              <View>
                <Text className="text-title text-lg font-extrabold tracking-tight">
                  Ride Requests
                </Text>
                {!hasRides && (
                  <Text className="mt-0.5 text-xs font-medium text-slate-500">
                    No active requests at the moment
                  </Text>
                )}
                {hasRides && (
                  <Text className="mt-0.5 text-xs font-medium text-slate-500">
                    Tap a request to preview route & accept
                  </Text>
                )}
              </View>
              {hasRides && (
                <View className="h-9 w-9 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/20">
                  <Text className="text-sm font-extrabold text-violet-400">{rides.length}</Text>
                </View>
              )}
            </View>

            {/* Empty state - takes minimal space when no rides */}
            {!hasRides && !isLoading && (
              <Animated.View
                entering={ZoomIn.springify()}
                className="items-center justify-center gap-2 py-2">
                <Text className="text-2xl">🛣️</Text>
                <Text className="text-sm font-semibold">No ride requests</Text>
                <Text className="text-center text-xs leading-4 text-slate-400">
                  New requests will appear here as riders book nearby
                </Text>
              </Animated.View>
            )}

            {/* Ride cards - will fill available space when rides exist */}
            {hasRides && (
              <View className="flex-1">
                {rides.map((ride, i) => (
                  <RideCard
                    key={ride._id}
                    ride={ride}
                    isSelected={selectedRide?._id === ride._id}
                    onPress={handleSelectRide}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Loading overlay */}
      {isLoading && (
        <View className="absolute inset-0 items-center justify-center bg-slate-950/60">
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text className="mt-3 text-sm font-medium text-slate-400">Loading…</Text>
        </View>
      )}

      {/* RIDE REQUEST DETAIL SHEET */}
      <BottomSheet
        ref={requestSheetRef}
        index={-1}
        snapPoints={['55%', '85%']}
        enablePanDownToClose
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.55}
          />
        )}
        backgroundStyle={{ backgroundColor: BottomSheetBackgroundColor, borderRadius: 28 }}
        handleIndicatorStyle={{ backgroundColor: BottomSheetIndicatorColor, width: 40 }}
        onClose={handleDeselectRide}>
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 }}>
          {selectedRide && (
            <Animated.View entering={FadeInUp.duration(220)}>
              {/* Header */}
              <View className="mb-5 flex-row items-start justify-between border-b border-slate-800 py-4">
                <View className="flex-row items-center gap-x-1 pr-4">
                  {/* Avatar */}
                  <Avatar alt="Profile pic" className="h-12 w-12">
                    <AvatarImage
                      source={
                        selectedRide.riderProfile?.profilePictureKey?.trim()
                          ? { uri: selectedRide.riderProfile.profilePictureKey }
                          : require('@/assets/images/avatar.jpg')
                      }
                    />
                    <AvatarFallback className="bg-white/20">
                      <Text className="text-sm font-bold text-primary">
                        {selectedRide.riderProfile?.firstName?.[0]}
                        {selectedRide.riderProfile?.lastName?.[0]}
                      </Text>
                    </AvatarFallback>
                  </Avatar>
                  <View>
                    <View className="flex-row gap-2">
                      <Text className="text-title mb-1.5 text-[22px] font-extrabold tracking-tight">
                        {`${selectedRide.riderProfile?.firstName ?? ''} ${selectedRide.riderProfile?.lastName ?? ''}`.trim() ||
                          'Passenger'}
                      </Text>
                      <StarRating rating={selectedRide.riderRating} />
                    </View>
                    <View className='flex-row gap-2'>
                      <View className='rounded-xl px-3 bg-slate-300 border border-slate-400/60'>
                        <Text className='text-xs'>{getAge(new Date(driver.dob))}</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 self-start rounded-full bg-slate-900/30 px-3">
                        <MaterialIcons
                          name={
                            driver.gender === 'Male'
                              ? 'male'
                              : driver?.gender === 'Female'
                                ? 'female'
                                : 'transgender'
                          }
                          size={13}
                          color="rgba(255,255,255,0.8)"
                        />
                        <Text>{driver.gender}</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    Est. Fare
                  </Text>
                  <Text className="text-3xl font-extrabold tracking-tight text-emerald-400">
                    {formatFare(selectedRide.fare)}
                  </Text>
                </View>
              </View>

              {/* Route visual */}
              <View className="mb-5 flex-row gap-3 px-1">
                <View className="items-center pt-[18px]">
                  <View className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                  <View className="my-1 w-px flex-1 bg-slate-700" />
                  <View className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                </View>
                <View className="flex-1">
                  <View className="mb-3.5">
                    <Text className="mb-0.5 text-[10px] font-bold uppercase tracking-[1.5px] text-teal-400">
                      Pickup
                    </Text>
                    <Text className="text-title text-[15px] font-semibold leading-5">
                      {selectedRide.pickup?.address ?? 'Not set'}
                    </Text>
                  </View>
                  <View>
                    <Text className="mb-0.5 text-[10px] font-bold uppercase tracking-[1.5px] text-violet-400">
                      Destination
                    </Text>
                    <Text className="text-title text-[15px] font-semibold leading-5">
                      {selectedRide.destination?.address ?? 'Not set'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Route loading */}
              {routeLoading && (
                <View className="mb-4 flex-row items-center gap-2 rounded-xl bg-slate-800/40 px-4 py-3">
                  <ActivityIndicator size="small" color="#7C3AED" />
                  <Text className="text-sm font-medium text-slate-400">Calculating route…</Text>
                </View>
              )}

              {/* Stats */}
              <SheetSection title="Trip Details">
                <View className="flex-row gap-2.5">
                  <View className="bg-primary-background flex-1 items-center rounded-2xl border border-slate-800 p-3.5">
                    <Text className="mb-1 text-base font-extrabold tracking-tight text-primary">
                      {distanceFormat(selectedRide.distance)}
                    </Text>
                    <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Distance
                    </Text>
                  </View>
                  <View className="bg-primary-background flex-1 items-center rounded-2xl border border-slate-800 p-3.5">
                    <Text className="mb-1 text-base font-extrabold tracking-tight text-primary">
                      {selectedRide.expectedDuration ?? '—'}
                    </Text>
                    <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Duration
                    </Text>
                  </View>
                  <View className="bg-primary-background flex-1 items-center rounded-2xl border border-slate-800 p-3.5">
                    <Text className="mb-1 text-base font-extrabold tracking-tight text-primary">
                      Now
                    </Text>
                    <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Scheduled
                    </Text>
                  </View>
                </View>
              </SheetSection>

              {/* Cannot accept warning */}
              {!acceptCheck.ok && acceptCheck.reason && (
                <Animated.View
                  entering={FadeInDown}
                  className="mb-4 flex-row items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                  <Text className="text-base">ℹ️</Text>
                  <Text className="flex-1 text-[13px] font-semibold leading-[18px] text-amber-400">
                    {acceptCheck.reason}
                  </Text>
                </Animated.View>
              )}

              {/* Action buttons */}
              <View className="mt-2 flex-row gap-3">
                <Button
                  className="min-h-[56px] flex-1 items-center justify-center rounded-2xl border-2 border-red-500/40 bg-red-500/10 py-4"
                  onPress={handleReject}
                  disabled={actionLoading !== null}>
                  {actionLoading === 'reject' ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Text className="text-[15px] font-extrabold text-red-400">✕ Decline</Text>
                  )}
                </Button>
                <Button
                  className={`min-h-[56px] flex-1 items-center justify-center rounded-2xl border-2 border-green-500 bg-green-600 py-4 ${!acceptCheck.ok ? 'opacity-30' : 'opacity-100'}`}
                  onPress={handleAccept}
                  disabled={!acceptCheck.ok || actionLoading !== null}>
                  {actionLoading === 'accept' ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-[15px] font-extrabold text-white">✓ Accept</Text>
                  )}
                </Button>
              </View>
            </Animated.View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
});
