import { useDriver } from '@/hooks/useDriver';
import { api, Id } from '@tutem/api';
import { useQuery, useAction } from 'convex/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { FunctionReturnType } from 'convex/server';
import { useColorScheme } from 'nativewind';
import { useToast } from '@/components/CustomToast';
import { Link, Redirect } from 'expo-router';
import { Text, Button, Loader } from '@tutem/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CurrentRideCard, RideRequestCard as RideCard } from '@/components/RideCard';
import { getDriverChannel, getGlobalChannel } from '@/lib/ably';
import { startLocationTracking, stopLocationTracking } from '@/lib/locationService';
import DriverMarker from '@/components/DriverMarker';
import { useDriverLiveLocation } from '@/hooks/useDriverLiveLocation';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';

// Types

type RideRequest = NonNullable<FunctionReturnType<typeof api.routes.rides.getRideRequests>[number]>;
type Driver = NonNullable<FunctionReturnType<typeof api.routes.driver.getUser>>;
type CurrentRide = NonNullable<
  FunctionReturnType<typeof api.routes.rides.getDriverCurrentRideByDriverId>
>;

type Cords = { latitude: number; longitude: number };

// Constants

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Map takes ~62% of screen height in the scrollable layout
const MAP_HEIGHT = Math.round(SCREEN_HEIGHT * 0.4);

// Height of the ride requests list panel
const LIST_PANEL_HEIGHT = Math.round(SCREEN_HEIGHT * 0.45);

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
  const { driver } = useDriver();

  const currentRide = useQuery(
    api.routes.rides.getDriverCurrentRideByDriverId,
    driver?.driverDetails ? { driverId: driver.driverDetails._id } : 'skip'
  );

  const driverDetails = driver?.driverDetails;

  // Start / stop background location foreground service whenever the
  // driver toggles online / offline via the Convex isAvailableForRide flag.
  useEffect(() => {
    if (!driverDetails) {
      stopLocationTracking();
      return;
    }

    if ((driverDetails.isAvailableForRide && driverDetails.isOnline) || currentRide) {
      const user_id = driver?._id;
      if (user_id) {
        console.log('started location tracking..');
        startLocationTracking({ driverId: driverDetails._id, user_id });
      }
    } else {
      console.log('stopped location tracking');
      stopLocationTracking();
    }
  }, [driverDetails?._id, driverDetails?.isAvailableForRide, !!currentRide, driver?._id]);

  // Live GPS
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let globalChannel: ReturnType<typeof getGlobalChannel> | null = null;
    let isCancelled = false;

    const updatePresence = async (lat: number, lng: number) => {
      if (
        driverDetails &&
        driverDetails.isAvailableForRide &&
        driverDetails.isOnline &&
        !currentRide
      ) {
        try {
          await globalChannel?.presence.update({
            driverId: driverDetails._id,
            latitude: lat,
            longitude: lng,
            vehicleClass: driver?.driverDetails?.isLicenseVerified ? 'verified' : 'Not Verified',
            lastUpdated: Date.now(),
          });
        } catch (e) {
          console.error('Ably presence update error:', e);
        }
      } else if (globalChannel) {
        globalChannel.presence.leave().catch(() => {});
      }
    };

    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || isCancelled) return;

      // Presence handling for nearby search discovery
      globalChannel = getGlobalChannel(undefined, driver?._id);

      // Fetch initial position immediately
      try {
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (isCancelled) return;
        const coords = {
          latitude: initialLoc.coords.latitude,
          longitude: initialLoc.coords.longitude,
        };

        // Publish initial location if online
        if (
          (driverDetails?._id && driverDetails.isAvailableForRide && driverDetails.isOnline) ||
          (currentRide && driverDetails)
        ) {
          const channel = getDriverChannel(driverDetails._id, driver?._id);
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

      if (isCancelled) return;

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
            const channel = getDriverChannel(driverDetails._id, driver?._id);
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

      if (isCancelled) {
        sub.remove();
        sub = null;
        return;
      }

      // Also publish at a regular interval (every 10s) to satisfy "constant update" requirement
      intervalId = setInterval(async () => {
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

            const channel = getDriverChannel(driverDetails._id, driver?._id);
            if (channel) {
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
          })
          .catch(() => {});
      }
    };

    start();

    // This cleanup IS properly returned to React
    return () => {
      isCancelled = true;
      sub?.remove();
      if (intervalId !== null) clearInterval(intervalId);
      globalChannel?.presence.leave().catch(() => {});
    };
  }, [driverDetails?._id, driverDetails?.isAvailableForRide, !!currentRide]);

  useEffect(() => {
    if (currentRide && !router.canGoBack())
      router.push({
        pathname: '/ride/current',
        params: { id: currentRide._id, driverId: currentRide.driverId },
      });
  }, [currentRide]);

  if (driver === undefined || currentRide === undefined)
    return (
      <View className="flex-1 items-center justify-center">
        <Loader subtitle="Loading..." />
      </View>
    );
  if (driver === null) return <Redirect href={'/register'} />;
  if (driver.driverDetails === null) return <Redirect href={'/registerAsDriver'} />;

  return <RideRequests driver={driver} currentRide={currentRide} />;
}

export const RideRequests = memo(
  ({ driver, currentRide }: { driver: Driver; currentRide: CurrentRide | null }) => {
    const { showToast } = useToast();
    const { sessionToken } = useAuth();
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

    const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(null);

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

    // Accept / Reject
    const canAcceptRide = useCallback((): { ok: boolean; reason?: string } => {
      if (!driver?.driverDetails?.isAvailableForRide || !driver.driverDetails.isOnline)
        return { ok: false, reason: 'You must be online to accept rides' };
      return { ok: true };
    }, [driver]);

    const handleAccept = async (rideId: Id<'ride'>) => {
      if (!driver?.driverDetails) return;
      const { ok, reason } = canAcceptRide();
      if (!ok) {
        showToast({ title: 'Attention!', description: reason, type: 'info' });
        return;
      }
      setActionLoading('accept');
      try {
        await acceptRide({ sessionToken: sessionToken || "", driverId: driver.driverDetails._id, rideId });
        showToast({
          title: 'Ride Accepted',
          description: 'Ride accepted successfully',
          type: 'success',
        });
      } catch (e) {
        console.error(e);
        showToast({ title: 'Failed', description: 'Failed to accept ride', type: 'error' });
      } finally {
        setActionLoading(null);
      }
    };

    const handleReject = async (rideId: Id<'ride'>) => {
      if (!driver?.driverDetails) return;
      setActionLoading('reject');
      try {
        await rejectRide({ sessionToken: sessionToken || "", driverId: driver.driverDetails._id, rideId });
        showToast({ title: 'Ride Rejected', description: 'Ride rejected', type: 'success' });
      } catch (e) {
        console.error(e);
        showToast({ title: 'Failed', description: 'Failed to reject ride', type: 'error' });
      } finally {
        setActionLoading(null);
      }
    };

    const acceptCheck = canAcceptRide();

    const handleClick = () => {
      if (currentRide)
        router.push({
          pathname: '/ride/current',
          params: { id: currentRide._id, driverId: currentRide.driverId },
        });
    };

    return (
      <View className="flex-1 bg-background">
        {actionLoading && (
          <Loader
            subtitle={actionLoading === 'accept' ? 'Accepting ride...' : 'Rejecting ride...'}
          />
        )}
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEventThrottle={16}
          contentContainerStyle={{ flexGrow: 1 }}>
          {/* MAP BLOCK - fixed height when rides exist, taller when no rides */}
          <View
            style={{
              height: currentRide ? SCREEN_HEIGHT * 0.5 : hasRides ? MAP_HEIGHT : MAP_HEIGHT * 2,
            }}
            className="relative">
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={{ flex: 1 }}
              customMapStyle={[]}
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
            </MapView>

            {/* Map overlay controls — pinned inside the map block */}
            <View
              style={{ position: 'absolute', top: 10, left: 10, right: 10 }}
              className="flex-row items-start justify-between"
              pointerEvents="box-none">
              <View />
              <TouchableOpacity
                onPress={() => fitMap([driverLocation].filter(Boolean) as Cords[])}
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

          {currentRide ? (
            <View className="mx-4 flex-1 items-center justify-center bg-background">
              <CurrentRideCard key={currentRide._id} ride={currentRide} onPress={handleClick} />
            </View>
          ) : (
            <>
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
              ) : hasRides ? (
                <View className="flex-1 px-4 pt-2">
                  {/* Section header */}
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-title text-lg font-extrabold tracking-tight">
                      Ride Requests
                    </Text>
                    <View className="h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-primary/20">
                      <Text className="text-sm font-extrabold text-primary">{rides.length}</Text>
                    </View>
                  </View>

                  {/* Ride cards - will fill available space when rides exist */}
                  <View className="flex-1">
                    {rides.map((ride, i) => (
                      <RideCard
                        key={ride._id}
                        ride={ride}
                        acceptCheck={acceptCheck}
                        handleAccept={handleAccept}
                        handleReject={handleReject}
                      />
                    ))}
                  </View>
                </View>
              ) : (
                <View className="absolute bottom-0 w-full bg-background py-2">
                  <Text className="text-center text-sm font-semibold text-primary">
                    No ride requests{'\n'}We'll notify you when there are!
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Loading overlay */}
        {isLoading && <Loader subtitle="Loading..." />}
      </View>
    );
  }
);
