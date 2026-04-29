import { Text } from '@/components/ui/text';
import { useAuth } from '@clerk/expo';
import { api, Id } from '@tutem/api';
import { useQuery, useAction } from 'convex/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Dimensions,
  ScrollView,
  ImageBackground,
  Image,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { FunctionReturnType } from 'convex/server';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/CustomToast';
import { router } from 'expo-router';
import { fetchRoute } from '@/lib/maps';
import { mapStyle } from '../../../../user-app/constants/mapStyles';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import StarRating from '@/components/StarRating';
import { distanceFormat, formatFare, numberFormat } from '@/lib/utils';
import { RideRequestCard as RideCard } from '@/components/RideCard';
import { getDriverChannel, getGlobalChannel } from '@/lib/ably';
import { startLocationTracking, stopLocationTracking } from '@/lib/locationService';

import PulseDot from '@/components/PulseDot';
import LiveTimer from '@/components/LiveTimer';
import useThemeColors from '@/hooks/useColorScheme';

// Types

type RideRequest = NonNullable<FunctionReturnType<typeof api.routes.rides.getRideRequests>[number]>;

type Coords = { latitude: number; longitude: number };
type RouteCoords = Coords[];

type RouteResult = {
  polyline: RouteCoords;
  distance: { text: string; value: number };
  duration: string;
} | null;

type RouteState = {
  segmentA: RouteCoords;
  segmentB: RouteCoords;
  remainingDistance?: string;
  remainingDuration?: string;
};

// Constants

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Map takes ~62% of screen height in the scrollable layout
const MAP_HEIGHT = Math.round(SCREEN_HEIGHT * 0.42);

// Height of the ride requests list panel
const LIST_PANEL_HEIGHT = Math.round(SCREEN_HEIGHT * 0.45);

function openNavigation(lat: number, lng: number) {
  const url = Platform.select({
    ios: `maps://?daddr=${lat},${lng}`,
    android: `google.navigation:q=${lat},${lng}`,
  });
  if (url) {
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`)
    );
  }
}

// Route Legend

function RouteLegend({ labelA, labelB }: { labelA: string; labelB: string }) {
  return (
    <View className="gap-1.5 rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2">
      <View className="flex-row items-center gap-2">
        <View className="h-1 w-4 rounded-full bg-teal-400" />
        <Text className="text-[10px] font-semibold text-slate-400">{labelA}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <View className="h-1 w-4 rounded-full bg-violet-500" />
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
  const { showToast } = useToast();
  const { iconColor, BottomSheetBackgroundColor, BottomSheetIndicatorColor, iconBackgroundColor} = useThemeColors();

  const driver = useQuery(api.routes.driver.getDriver, { clerkId: userId ?? '' });
  const vehicle = useQuery(
    api.routes.vehicle.getVehicleByDriverId,
    driver && driver.driverDetails ? { driverId: driver.driverDetails._id } : 'skip'
  );

  const rideRequests = useQuery(
    api.routes.rides.getRideRequests,
    driver?.driverDetails ? { driverId: driver.driverDetails._id } : 'skip'
  );

  const currentRide = useQuery(
    api.routes.rides.getDriverCurrentRide,
    driver?.driverDetails ? { driverId: driver.driverDetails._id } : 'skip'
  );

  const acceptRide = useAction(api.routes.rideActions.acceptRideAction);
  const rejectRide = useAction(api.routes.rideActions.rejectRide);
  const completeRide = useAction(api.routes.rideActions.completeRide);

  const handleCompleteRide = async (driverId: Id<'driver'>, rideId: Id<'ride'>) => {
    try {
      await completeRide({ driverId, rideId });
      router.push(`/feedback/${rideId}`);
      showToast({
        type: 'success',
        title: 'Ride completed',
        description: 'Ride completed successfully.',
      });

      // activeSheetRef.current?.close();
    } catch (e: any) {
      console.log('Error', e);
      showToast({
        type: 'error',
        title: 'Failed',
        description: e.data ?? 'Failed to complete ride.',
      });
    }
  };

  // Map & location
  const mapRef = useRef<MapView>(null);
  const [driverLocation, setDriverLocation] = useState<Coords | null>(null);
  const [routeState, setRouteState] = useState<RouteState | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // UI state
  const [selectedRide, setSelectedRide] = useState<RideRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(null);

  // Bottom sheet refs
  const requestSheetRef = useRef<BottomSheet>(null);
  const activeSheetRef = useRef<BottomSheet>(null);

  const { colorScheme: currentTheme } = useColorScheme();
  const isDark = currentTheme === 'dark';

  // Derived state
  const isLoading = driver === undefined || (driver?.driverDetails && rideRequests === undefined);
  const hasError = driver === null;
  const rides = (rideRequests ?? []) as RideRequest[];
  const hasRides = rides.length > 0;

  // Whether the active ride hasn't been started yet
  const isRideOpen = currentRide?.status === 'Open';
  const isActive = currentRide?.status === 'Active';
  const driverDetails = driver?.driverDetails;

  // Start / stop background location foreground service whenever the
  // driver toggles online / offline via the Convex isAvailableForRide flag.
  useEffect(() => {
    if (!driverDetails?._id) return;

    if (driverDetails.isAvailableForRide || currentRide) {
      // Fetch a fresh Clerk token and pass real credentials so the headless
      // background task publishes to the correct driver Ably channel.
      getToken().then((authToken) => {
        startLocationTracking(
          authToken ? { driverId: driverDetails._id, authToken } : undefined
        );
      });
    } else {
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
        setDriverLocation(coords);

        // Publish initial location if online
        if (driverDetails?._id && (driverDetails.isAvailableForRide || currentRide)) {
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
        if (driverDetails?._id && driverDetails.isAvailableForRide && !currentRide) {
          try {
            await globalChannel?.presence.update({
              driverId: driverDetails._id,
              latitude: lat,
              longitude: lng,
              vehicleClass: driver?.driverDetails?.organization?.isVehicleRCVerificationRequired
                ? 'verified'
                : 'standard', // Example metadata
              lastUpdated: Date.now(),
            });
          } catch (e) {
            console.error('Ably presence update error:', e);
          }
        } else if (globalChannel) {
          // If not available or on a ride, leave the global discovery channel
          globalChannel.presence.leave().catch(() => {});
        }
      };

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 15 },
        (loc) => {
          const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };

          setDriverLocation(coords);
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
      }, 10000); // 10 seconds

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

  useEffect(() => {
    if (!currentRide || !driverLocation) return;

    let cancelled = false;

    // wait 2 minutes before firing request
    const timer = setTimeout(
      async () => {
        const pickupCords = {
          latitude: currentRide.pickup.latitude,
          longitude: currentRide.pickup.longitude,
        };

        const destCords = {
          latitude: currentRide.destination.latitude,
          longitude: currentRide.destination.longitude,
        };

        try {
          const [driven, remaining]: [RouteResult, RouteResult] = await Promise.all([
            fetchRoute(pickupCords, driverLocation),
            fetchRoute(driverLocation, destCords),
          ]);

          if (cancelled) return;

          setRouteState({
            segmentA: driven?.polyline ?? [],
            segmentB: remaining?.polyline ?? [],
            remainingDistance: remaining?.distance.text,
            remainingDuration: remaining?.duration,
          });
        } catch (error) {
          console.log(error);
        }
      },
      2 * 60 * 1000
    ); // 2 min

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [driverLocation, currentRide]);

  // Fit map to relevant points
  const fitMap = useCallback(
    (extra?: Coords[]) => {
      const coords: Coords[] = [];
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

  // Refit when active ride route updates
  useEffect(() => {
    if (!currentRide || !driverLocation) return;
    fitMap([
      { latitude: currentRide.pickup.latitude, longitude: currentRide.pickup.longitude },
      { latitude: currentRide.destination.latitude, longitude: currentRide.destination.longitude },
    ]);
  }, [routeState, currentRide]);

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

      setRouteLoading(true);
      try {
        const [toPickup, toDestination]: [RouteResult, RouteResult] = await Promise.all([
          fetchRoute(driverLocation, pickupCords),
          fetchRoute(pickupCords, destCords),
        ]);
        setRouteState({
          segmentA: toPickup?.polyline ?? [],
          segmentB: toDestination?.polyline ?? [],
        });

        fitMap([pickupCords, destCords]);
      } catch (e) {
        console.error('Route fetch error', e);
      } finally {
        setRouteLoading(false);
      }
    },
    [driverLocation, fitMap]
  );

  // Deselect ride → clear preview route
  const handleDeselectRide = useCallback(() => {
    setSelectedRide(null);
    setRouteState(null);
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
      if (currentRide) return { ok: false, reason: 'Complete your current ride first' };
      if (!driver?.driverDetails?.isAvailableForRide)
        return { ok: false, reason: 'You must be online to accept rides' };
      return { ok: true };
    },
    [driver, currentRide]
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

  // Active ride coords
  const activePickup = currentRide
    ? { latitude: currentRide.pickup.latitude, longitude: currentRide.pickup.longitude }
    : null;
  const activeDest = currentRide
    ? { latitude: currentRide.destination.latitude, longitude: currentRide.destination.longitude }
    : null;

  // Selected ride coords
  const selectedPickup = selectedRide
    ? { latitude: selectedRide.pickup.latitude, longitude: selectedRide.pickup.longitude }
    : null;
  const selectedDest = selectedRide
    ? { latitude: selectedRide.destination.latitude, longitude: selectedRide.destination.longitude }
    : null;

  useEffect(() => {
    if (!currentRide) {
      activeSheetRef.current?.close();
      requestSheetRef.current?.close();
    }
  }, [currentRide]);

  if (currentRide) {
    // ACTIVE RIDE LAYOUT — full-screen map + non-closable bottom sheet

    return (
      <View className="flex-1 bg-background">
        <StatusBar style={isDark ? 'light' : 'dark'} />

        {/* Full-screen map */}
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          customMapStyle={isDark ? mapStyle.dark : []}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          initialRegion={
            driverLocation
              ? { ...driverLocation, latitudeDelta: 0.04, longitudeDelta: 0.04 }
              : { latitude: 28.6139, longitude: 77.209, latitudeDelta: 0.08, longitudeDelta: 0.08 }
          }>
          {driverLocation && (
            <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
              <View className="h-8 w-8 items-center justify-center rounded-full border-2 border-emerald-400 bg-slate-800">
                <Text className="text-lg">🚗</Text>
              </View>
            </Marker>
          )}

          {activePickup && activeDest && (
            <>
              {routeState?.segmentA && routeState.segmentA.length > 1 ? (
                <Polyline coordinates={routeState.segmentA} strokeColor="#19780e" strokeWidth={4} />
              ) : (
                <Polyline
                  coordinates={[activePickup, driverLocation ?? activePickup]}
                  strokeColor="#2DD4BF"
                  strokeWidth={3}
                  lineDashPattern={[6, 5]}
                />
              )}
              {routeState?.segmentB && routeState.segmentB.length > 1 ? (
                <Polyline coordinates={routeState.segmentB} strokeColor="#7C3AED" strokeWidth={4} />
              ) : (
                <Polyline
                  coordinates={[driverLocation ?? activePickup, activeDest]}
                  strokeColor="#7C3AED"
                  strokeWidth={3}
                  lineDashPattern={[6, 5]}
                />
              )}
              <Marker coordinate={activePickup} anchor={{ x: 0.5, y: 0.5 }}>
                <View className="h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-green-800">
                  <Text className="text-xs font-bold text-white">P</Text>
                </View>
              </Marker>
              <Marker coordinate={activeDest} anchor={{ x: 0.5, y: 0.5 }}>
                <View className="h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-violet-600">
                  <Text className="text-xs font-bold text-white">D</Text>
                </View>
              </Marker>
            </>
          )}
        </MapView>

        {/* Map controls */}
        <View
          style={{ position: 'absolute', top: 10, left: 10, right: 10 }}
          className="flex-row items-start justify-between"
          pointerEvents="box-none">
          <View pointerEvents="none">
            <Animated.View entering={FadeInUp.springify()}>
              <RouteLegend labelA="Driven" labelB="Remaining" />
            </Animated.View>
          </View>
          <TouchableOpacity
            onPress={() => fitMap([activePickup, activeDest].filter(Boolean) as Coords[])}
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

        {/* Active Ride Detail Sheet — starts at index 1 (expanded) */}
        <BottomSheet
          ref={activeSheetRef}
          index={1}
          snapPoints={['40%', '80%']}
          enablePanDownToClose={false}
          backgroundStyle={{ backgroundColor: BottomSheetBackgroundColor, borderRadius: 28 }}
          handleIndicatorStyle={{ backgroundColor: BottomSheetIndicatorColor, width: 40 }}>
          <BottomSheetScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 }}>
            <Animated.View entering={FadeInUp.duration(250)}>
              {/* Status banner  */}
              <View
                className={`mb-4 flex-row items-center gap-3 rounded-2xl border px-4 py-3 ${
                  currentRide.status === 'Open'
                    ? 'border-amber-500/30 bg-amber-500/10'
                    : 'border-emerald-500/30 bg-emerald-500/10'
                }`}>
                <PulseDot
                  color={currentRide.status === 'Open' ? 'bg-orange-400' : 'bg-green-400'}
                />
                <View className="flex-1">
                  <Text
                    className={`text-sm font-extrabold ${currentRide.status === 'Open' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {currentRide.status === 'Open' ? 'Accepted' : 'Ride in Progress'}
                  </Text>
                  <Text className="mt-0.5 text-[11px] font-medium text-slate-500">
                    {currentRide.status === 'Open'
                      ? 'Waiting to pick up rider'
                      : 'Rider is in the vehicle'}
                  </Text>
                </View>
                <Text
                  className={`text-base font-extrabold tabular-nums ${currentRide.status === 'Open' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  <LiveTimer
                    startTimestamp={
                      currentRide.status === 'Open'
                        ? currentRide.updatedAt
                        : (currentRide.startedAt ?? currentRide.updatedAt)
                    }
                  />
                </Text>
              </View>

              {/* Rider + fare */}
              <View className="mb-4 flex-row items-center justify-between border-b border-slate-800/60 pb-4">
                <View className="flex-1 flex-row items-center gap-3">
                  <View className="h-14 w-14 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/20 p-0.5">
                    <Avatar alt="Profile pic" className="h-12 w-12">
                      <AvatarImage
                        source={
                          currentRide.riderProfile.profilePictureKey
                            ? { uri: currentRide.riderProfile.profilePictureKey }
                            : require('@/assets/images/avatar.jpg')
                        }
                      />
                      <AvatarFallback className="bg-white/20">
                        <Text className="text-2xl font-bold text-primary">
                          {currentRide.riderProfile?.firstName?.[0]?.toUpperCase() ?? 'R'}
                        </Text>
                      </AvatarFallback>
                    </Avatar>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-primary" numberOfLines={1}>
                      {`${currentRide.riderProfile?.firstName ?? ''} ${currentRide.riderProfile?.lastName ?? ''}`.trim() ||
                        'Rider'}
                    </Text>
                    <View className="flex-row items-center gap-1.5 self-start rounded-full bg-green-500/25 px-3 py-1">
                      <MaterialIcons
                        name={
                          currentRide.riderProfile.gender === 'Male'
                            ? 'male'
                            : currentRide.riderProfile?.gender === 'Female'
                              ? 'female'
                              : 'transgender'
                        }
                        size={13}
                        color="black"
                      />
                      <Text className="text-xs font-medium text-primary">
                        {currentRide.riderProfile.gender}
                      </Text>
                    </View>
                    {currentRide.riderRating?.average != null && (
                      <View className="mt-0.5 flex-row items-center gap-1">
                        <Text className="text-xs text-amber-400">★</Text>
                        <Text className="text-xs font-semibold text-slate-400">
                          {currentRide.riderRating.average.toFixed(1)}
                        </Text>
                        <Text className="text-xs text-slate-600">
                          ({currentRide.riderRating.totalRatings})
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View className="ml-3 items-end">
                  <Text className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    Fare
                  </Text>
                  <Text className="text-2xl font-extrabold tracking-tight text-emerald-600">
                    {formatFare(currentRide.fare)}
                  </Text>
                </View>
              </View>

              {/* START RIDE BUTTON (only when status is "Open") */}
              {isRideOpen && driverDetails && (
                <Animated.View entering={FadeInDown.springify()} className="mb-4">
                  <Button
                    className="w-full items-center justify-center rounded-2xl border-2 border-emerald-400 bg-emerald-500"
                    onPress={() =>
                      router.push({
                        pathname: '/startRide',
                        params: {
                          driverId: driverDetails._id,
                          rideId: currentRide._id,
                        },
                      })
                    }>
                    <Text className="text-[17px] font-extrabold tracking-tight text-white">
                      ▶ Start Ride
                    </Text>
                  </Button>
                </Animated.View>
              )}

              {isActive && driverDetails && (
                <Animated.View entering={FadeInDown.springify()} className="mb-4">
                  <Button
                    className="w-full items-center justify-center rounded-2xl border-2 border-emerald-400 bg-emerald-500"
                    onPress={() => {
                      handleCompleteRide(driverDetails._id, currentRide._id);
                    }}>
                    <Text className="text-[17px] font-extrabold tracking-tight text-white">
                      ✓ Complete Ride
                    </Text>
                  </Button>
                </Animated.View>
              )}

              {/* Live stats */}
              <View className="mb-4 flex-row gap-2.5">
                <View className="bg-primary-background flex-1 items-center rounded-xl border border-slate-800 p-3">
                  <Text
                    className="mb-0.5 text-sm font-extrabold text-primary"
                    numberOfLines={1}
                    adjustsFontSizeToFit>
                    {routeState?.remainingDistance ?? `${distanceFormat(currentRide.distance)}`}
                  </Text>
                  <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Remaining
                  </Text>
                </View>
                <View className="bg-primary-background flex-1 items-center rounded-xl border border-slate-800 p-3">
                  <Text
                    className="mb-0.5 text-sm font-extrabold text-primary"
                    numberOfLines={1}
                    adjustsFontSizeToFit>
                    {routeState?.remainingDuration ?? currentRide.expectedDuration ?? '—'}
                  </Text>
                  <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    ETA
                  </Text>
                </View>
                <View className="bg-primary-background flex-1 items-center rounded-xl border border-slate-800 p-3">
                  <Text className="mb-0.5 text-sm font-extrabold text-primary">
                    {new Date(currentRide.updatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    {isRideOpen ? 'Accepted' : 'Started'}
                  </Text>
                </View>
              </View>

              {/* Route address card */}
              <View className="bg-primary-background mb-4 rounded-2xl border border-slate-800 p-4">
                <View className="mb-4 flex-row items-start gap-3">
                  <View className="mt-1 items-center">
                    <View className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                    <View className="mt-1 h-6 w-px bg-slate-700" />
                  </View>
                  <View className="flex-1">
                    <TouchableOpacity
                      onPress={() =>
                        activePickup &&
                        openNavigation(activePickup.latitude, activePickup.longitude)
                      }
                      activeOpacity={0.75}
                      className="flex-1">
                      <Text className="mb-0.5 text-[10px] font-bold uppercase tracking-[1.5px] text-teal-400">
                        Pickup
                      </Text>
                      <Text className="text-[14px] font-semibold leading-5 text-primary">
                        {currentRide.pickup?.address ?? 'Pickup not set'}
                      </Text>
                      <Text className="text-xs font-bold text-teal-400">Navigate →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View className="flex-row items-start gap-3">
                  <View className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                  <View className="flex-1">
                    <TouchableOpacity
                      onPress={() =>
                        activeDest && openNavigation(activeDest.latitude, activeDest.longitude)
                      }
                      activeOpacity={0.75}
                      className="flex-1">
                      <Text className="mb-0.5 text-[10px] font-bold uppercase tracking-[1.5px] text-violet-400">
                        Destination
                      </Text>
                      <Text className="text-[14px] font-semibold leading-5 text-primary">
                        {currentRide.destination?.address ?? 'Destination not set'}
                      </Text>
                      <Text className="text-xs font-bold text-violet-400">Navigate →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Animated.View>
          </BottomSheetScrollView>
        </BottomSheet>
      </View>
    );
  }

  // RIDE REQUESTS LAYOUT — scrollable (map + list scroll together as one page)
  return (
    <View className="flex-1 bg-background">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 40 }}>
        {/* MAP BLOCK (fixed height, scrolls with the page) */}
        <View style={{ height: MAP_HEIGHT }} className="relative">
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
                    latitudeDelta: 0.08,
                    longitudeDelta: 0.08,
                  }
            }>
            {/* Driver marker */}
            {driverLocation && (
              <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
                <View className="h-8 w-8 items-center justify-center rounded-full">
                  {vehicle?.class === 'Cab' && (
                    <Image
                      source={require('@/assets/images/cab_icon.png')}
                      style={{ width: 32, height: 32 }}
                      resizeMode="contain"
                    />
                  )}
                  {vehicle?.class === 'Bike' && (
                    <Image
                      source={require('@/assets/images/bike_icon.png')}
                      style={{ width: 32, height: 32 }}
                      resizeMode="contain"
                    />
                  )}
                  {vehicle?.class === 'Auto' && (
                    <Image
                      source={require('@/assets/images/rickshaw_icon.png')}
                      style={{ width: 32, height: 32 }}
                      resizeMode="contain"
                    />
                  )}
                </View>
              </Marker>
            )}

            {/* Request preview route */}
            {selectedRide && selectedPickup && selectedDest && (
              <>
                {routeState?.segmentA && routeState.segmentA.length > 1 ? (
                  <Polyline
                    coordinates={routeState.segmentA}
                    strokeColor="#2DD4BF"
                    strokeWidth={4}
                  />
                ) : (
                  <Polyline
                    coordinates={[driverLocation ?? selectedPickup, selectedPickup]}
                    strokeColor="#2DD4BF"
                    strokeWidth={3}
                    lineDashPattern={[6, 5]}
                  />
                )}
                {routeState?.segmentB && routeState.segmentB.length > 1 ? (
                  <Polyline
                    coordinates={routeState.segmentB}
                    strokeColor="#7C3AED"
                    strokeWidth={4}
                  />
                ) : (
                  <Polyline
                    coordinates={[selectedPickup, selectedDest]}
                    strokeColor="#7C3AED"
                    strokeWidth={3}
                    lineDashPattern={[6, 5]}
                  />
                )}
                <Marker coordinate={selectedPickup} anchor={{ x: 0.5, y: 0.5 }}>
                  <View className="h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-teal-500">
                    <Text className="text-xs font-bold text-white">P</Text>
                  </View>
                </Marker>
                <Marker coordinate={selectedDest} anchor={{ x: 0.5, y: 0.5 }}>
                  <View className="h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-violet-600">
                    <Text className="text-xs font-bold text-white">D</Text>
                  </View>
                </Marker>
              </>
            )}
          </MapView>

          {/* Map overlay controls — pinned inside the map block */}
          <View
            style={{ position: 'absolute', top: 10, left: 10, right: 10 }}
            className="flex-row items-start justify-between"
            pointerEvents="box-none">
            <View pointerEvents="none">
              <Animated.View entering={FadeInUp.springify()}>
                <RouteLegend
                  labelA={selectedRide ? 'To Pickup' : 'Driver'}
                  labelB={selectedRide ? 'To Destination' : 'Route'}
                />
              </Animated.View>
            </View>
            <TouchableOpacity
              onPress={() => fitMap([selectedPickup, selectedDest].filter(Boolean) as Coords[])}
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

        {/* Ride requests list */}
        <View className="flex-1 px-4 pt-4">
          {/* Section header */}
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-extrabold tracking-tight text-primary">
                Ride Requests
              </Text>
              <Text className="mt-0.5 text-xs font-medium text-slate-500">
                Tap a request to preview route & accept
              </Text>
            </View>
            {hasRides && (
              <View className="h-9 w-9 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/20">
                <Text className="text-sm font-extrabold text-violet-400">{rides.length}</Text>
              </View>
            )}
          </View>

          {/* Empty state */}
          {!hasRides && !isLoading && (
            <Animated.View
              entering={ZoomIn.springify()}
              className="items-center justify-center gap-3 py-12">
              <Text className="text-3xl">🛣️</Text>
              <Text className="text-sm font-bold">Waiting for ride requests</Text>
              <Text className="text-center text-xs leading-4 text-slate-400">
                New requests will appear here as riders book nearby
              </Text>
            </Animated.View>
          )}

          {/* Ride cards */}
          {rides.map((ride, i) => (
            <RideCard
              key={ride._id}
              ride={ride}
              isSelected={selectedRide?._id === ride._id}
              onPress={handleSelectRide}
            />
          ))}
        </View>
      </ScrollView>

      {/* Loading overlay */}
      {isLoading && (
        <View className="absolute inset-0 items-center justify-center bg-slate-950/60">
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text className="mt-3 text-sm font-medium text-slate-400">Loading…</Text>
        </View>
      )}

      {/* RIDE REQUEST DETAIL SHEET
      Opens on top; map is still visible and draggable behind it. */}
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
                  <Text className="mb-1.5 text-[22px] font-extrabold tracking-tight text-primary">
                    {`${selectedRide.riderProfile?.firstName ?? ''} ${selectedRide.riderProfile?.lastName ?? ''}`.trim() ||
                      'Passenger'}
                  </Text>
                  <StarRating rating={selectedRide.riderRating} />
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
                    <Text className="text-[15px] font-semibold leading-5 text-primary">
                      {selectedRide.pickup?.address ?? 'Not set'}
                    </Text>
                  </View>
                  <View>
                    <Text className="mb-0.5 text-[10px] font-bold uppercase tracking-[1.5px] text-violet-400">
                      Destination
                    </Text>
                    <Text className="text-[15px] font-semibold leading-5 text-primary">
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
}
