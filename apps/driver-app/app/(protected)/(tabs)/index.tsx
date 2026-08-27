import { useDriver } from '@/hooks/useDriver';
import { api, Id } from '@tutem/api';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { FunctionReturnType } from 'convex/server';
import { useColorScheme } from 'nativewind';
import { useToast } from '@/components/CustomToast';
import { Link, Redirect } from 'expo-router';
import { Text, Button, Loader, ImageViewerModal } from '@tutem/ui';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { CurrentRideCard, RideRequestCard as RideCard } from '@/components/RideCard';
import DriverMarker from '@/components/DriverMarker';
import { useDriverLiveLocation } from '@/hooks/useDriverLiveLocation';
import { useLocationManager } from '@/hooks/useLocationManager';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';
import {
  useAuthenticatedQuery,
  useAuthenticatedAction,
  useAuthenticatedMutation,
} from '@/hooks/customApi';
import { cn } from '@/lib/utils';

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

  const currentRide = useAuthenticatedQuery(
    api.routes.rides.getDriverCurrentRideByDriverId,
    driver?.driverDetails ? { driverId: driver.driverDetails._id } : 'skip'
  );

  const driverDetails = driver?.driverDetails;

  useLocationManager({
    driverId: driverDetails?._id,
    userId: driver?._id,
    isOnline: driverDetails?.isOnline,
    isAvailableForRide: driverDetails?.isAvailableForRide,
    isLicenseVerified: driverDetails?.isLicenseVerified,
    hasActiveRide: !!currentRide,
  });

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
    const driverLocation = useDriverLiveLocation();

    const vehicle = useAuthenticatedQuery(
      api.routes.vehicle.getVehicleByDriverId,
      driver.driverDetails ? { driverId: driver.driverDetails._id } : 'skip'
    );

    const rideRequests = useAuthenticatedQuery(
      api.routes.rides.getRideRequests,
      driver.driverDetails ? { driverId: driver.driverDetails._id } : 'skip'
    );
    const acceptRide = useAuthenticatedAction(api.actions.ride.acceptRideAction);
    const rejectRide = useAuthenticatedAction(api.actions.ride.rejectRide);
    const toggleGenderMatching = useAuthenticatedMutation(api.routes.driver.toggleGenderMatching);

    // Map & location
    const mapRef = useRef<MapView>(null);

    const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(null);
    const [viewerImage, setViewerImage] = useState<{ uri?: string | null; name?: string } | null>(
      null
    );

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
        await acceptRide({
          driverId: driver.driverDetails._id,
          rideId,
        });
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
        await rejectRide({
          driverId: driver.driverDetails._id,
          rideId,
        });
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

    const toggleGenderMatch = async () => {
      if (driver.driverDetails === null) return;
      await toggleGenderMatching({ id: driver.driverDetails._id });
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
              height: !vehicle
                ? SCREEN_HEIGHT * 0.65
                : currentRide
                  ? SCREEN_HEIGHT * 0.5
                  : hasRides
                    ? MAP_HEIGHT
                    : MAP_HEIGHT * 2,
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
              {/* Gender Toggle */}
              <TouchableOpacity
                activeOpacity={0.8}
                className={cn(
                  'flex-row items-center gap-2 rounded-xl border border-slate-300 px-2.5 py-1.5 shadow-lg',
                  {
                    'bg-green-100': driver.driverDetails?.genderMatching,
                    'bg-red-100': !driver.driverDetails?.genderMatching,
                  }
                )}
                onPress={async () => {
                  if (!driver.driverDetails) return;
                  try {
                    await toggleGenderMatch();
                  } catch (error: any) {
                    console.log('error', error);
                    showToast({
                      type: 'error',
                      title: 'Failed',
                      description: error.data ?? 'Failed to switch',
                    });
                  }
                }}>
                <View
                  className={cn('h-7 w-7 items-center justify-center rounded-full', {
                    'bg-green-500': driver.driverDetails?.genderMatching,
                    'bg-red-600': !driver.driverDetails?.genderMatching,
                  })}>
                  <Feather name="users" size={16} color="white" />
                </View>

                <View>
                  <Text className="text-[10px] text-gray-500">Gender Match</Text>
                  <Text className="text-xs font-bold text-primary">
                    {driver.driverDetails?.genderMatching ? 'Same' : 'Any'}
                  </Text>
                </View>
              </TouchableOpacity>
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
              <CurrentRideCard
                key={currentRide._id}
                ride={currentRide}
                onPress={handleClick}
                onViewRiderImage={(uri, name) => setViewerImage({ uri, name })}
              />
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
                        onViewRiderImage={(uri, name) => setViewerImage({ uri, name })}
                      />
                    ))}
                  </View>
                </View>
              ) : driver.driverDetails?.isOnline ? (
                <View className="absolute bottom-0 w-full bg-background py-2">
                  <Text className="text-center text-sm font-semibold text-primary">
                    No ride requests{'\n'}We'll notify you when there are!
                  </Text>
                </View>
              ) : (
                <View className="absolute bottom-0 w-full bg-background py-2">
                  <Text className="text-center text-sm font-semibold text-destructive">
                    You are offline{'\n'}Go online to receive ride requests!
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Loading overlay */}
        {isLoading && <Loader subtitle="Loading..." />}

        <ImageViewerModal
          visible={Boolean(viewerImage)}
          onClose={() => setViewerImage(null)}
          imageUri={viewerImage?.uri}
          name={viewerImage?.name}
          subtitle="Rider Profile"
        />
      </View>
    );
  }
);
