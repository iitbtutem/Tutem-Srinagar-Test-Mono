import { api, Id } from '@tutem/api';
import {
  useAuthenticatedQuery,
  useAuthenticatedMutation,
  useAuthenticatedAction,
} from '@/hooks/customApi';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Linking, Platform, Dimensions } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useColorScheme } from 'nativewind';
import { useToast } from '@/components/CustomToast';
import { Redirect, router, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { fetchRoute } from '@/lib/maps';
import { Fontisto, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { distanceFormat, formatFare, isNearby } from '@/lib/utils';
import useThemeColors from '@/hooks/useColorScheme';
import DriverMarker from '@/components/DriverMarker';
import { MapPinCheck } from 'lucide-react-native';
import { RideStatusBanner } from '@/components/RideStatusBanner';
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react-native';
import { useDriverLiveLocation } from '@/hooks/useDriverLiveLocation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Text,
  Button,
  Loader,
} from '@tutem/ui';
import { FunctionReturnType } from 'convex/server';
import GenderAge from '@/components/GenderAge';
import { BasicHeader } from '@/components/CustomHeader';
import { colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';

// Types

type Ride = NonNullable<FunctionReturnType<typeof api.routes.rides.getDriverRide>>;

type Cords = { latitude: number; longitude: number };

type RouteState = {
  polyline: Cords[];
  remainingDistance: {
    text: string;
    value: number;
  };
  remainingDuration?: string;
};

type CancelStep = 'reason' | 'confirm';

const CANCEL_REASONS = [
  'Rider at wrong location',
  'Safety concern with rider',
  'Vehicle breakdown / issue',
  'Personal emergency',
  'Other reason',
];
const CANCEL_REASONS_AFTER_START = [
  'Safety concern during trip',
  'Vehicle breakdown / issue',
  'Route blocked or inaccessible',
  'Incorrect destination provided',
  'Other reason',
];

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Map takes ~62% of screen height in the scrollable layout
const MAP_HEIGHT = Math.round(SCREEN_HEIGHT * 0.75);

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
        <Fontisto name="map-marker-alt" size={10} color={colors.pickup} />
        <Text className="text-[10px] font-semibold text-white">{labelA}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Fontisto name="map-marker-alt" size={10} color={colors.destination} />
        <Text className="text-[10px] font-semibold text-white">{labelB}</Text>
      </View>
    </View>
  );
}

function RouteCard({
  pickup,
  destination,
}: {
  pickup: { address: string } & Cords;
  destination: { address: string } & Cords;
}) {
  return (
    <View className="bg-primary-background mb-1 rounded-2xl border border-slate-800 p-4">
      <View className="mb-3 flex-row items-stretch pl-0.5">
        <View className="w-4 items-center">
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.pickup }} />
          <View className="my-1 w-px flex-1 bg-slate-700" />
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.destination }} />
        </View>
        <View className="ml-3 flex-1 gap-2.5">
          <TouchableOpacity
            onPress={() => openNavigation(pickup.latitude, pickup.longitude)}
            activeOpacity={0.75}
            className="flex-1">
            <Text
              className="mb-0.5 text-[10px] font-bold uppercase tracking-[1.5px]"
              style={{ color: colors.pickup }}>
              Pickup
            </Text>
            <Text className="text-title text-[14px] font-semibold leading-5">
              {pickup?.address ?? 'Pickup not set'}
            </Text>
            <Text className="text-xs font-bold" style={{ color: colors.pickup }}>
              Navigate →
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => openNavigation(destination.latitude, destination.longitude)}
            activeOpacity={0.75}
            className="flex-1">
            <Text
              className="mb-0.5 text-[10px] font-bold uppercase tracking-[1.5px]"
              style={{ color: colors.destination }}>
              Destination
            </Text>
            <Text className="text-title text-[14px] font-semibold leading-5">
              {destination?.address ?? 'Destination not set'}
            </Text>
            <Text className="text-xs font-bold" style={{ color: colors.destination }}>
              Navigate →
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function Ride() {
  const { id, driverId } = useLocalSearchParams<{ id: Id<'ride'>; driverId: Id<'driver'> }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { BottomSheetBackgroundColor, BottomSheetIndicatorColor } = useThemeColors();
  const { colorScheme: currentTheme } = useColorScheme();
  const isDark = currentTheme === 'dark';
  const { sessionToken } = useAuth();

  const [routeState, setRouteState] = useState<RouteState | null>(null);
  const [loading, setLoading] = useState<
    'driverArrived' | 'starting' | 'completing' | 'canceling' | null
  >(null);

  // Cancel flow state
  const [cancelStep, setCancelStep] = useState<CancelStep | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [canceledRideCharges, setCanceledRideCharges] = useState<{
    calculatedFare: number;
    baseDistance: number;
    basePrice: number;
    ratePerKm: number;
    chargableDistance: number;
    remainingDistance: number;
  } | null>(null);

  const driverLocation = useDriverLiveLocation();
  const mapRef = useRef<MapView>(null);
  const activeSheetRef = useRef<BottomSheet>(null);

  const ride = useAuthenticatedQuery(api.routes.rides.getDriverRide, id ? { id } : 'skip');
  const settings = useAuthenticatedQuery(api.routes.settings.rideSettings);
  const driverArrived = useAuthenticatedAction(api.actions.ride.driverArrived);
  const completeRide = useAuthenticatedAction(api.actions.ride.completeRide);
  const cancelRide = useAuthenticatedAction(api.actions.ride.driverCancelRide);
  const calculateDriverCancelRideCharges = useAuthenticatedAction(
    api.actions.ride.calculateDriverCancelRideCharges
  );
  const hasReachedDestination = useAuthenticatedMutation(api.routes.rides.hasReachedDestination);
  const vehicle = useAuthenticatedQuery(
    api.routes.vehicle.getVehicleByDriverId,
    ride ? { driverId } : 'skip'
  );

  const arrivedRadiusInMts = settings?.arrivedDistance ?? 100;

  // Map / route logic
  useEffect(() => {
    if (!ride || !driverLocation) return;
    const pickupCords = { latitude: ride.pickup.latitude, longitude: ride.pickup.longitude };
    const destCords = {
      latitude: ride.destination.latitude,
      longitude: ride.destination.longitude,
    };

    if (ride.status === 'Active') {
      const isNearDest = isNearby(driverLocation, destCords, arrivedRadiusInMts);
      if (isNearDest && !ride.hasReachedDestination) {
        if (cancelStep !== null) setCancelStep(null);
        hasReachedDestination({ driverId, rideId: ride._id }).catch((err) => {
          console.log('[current.tsx] hasReachedDestination error:', err);
        });
      }
    } else {
      const cords: Cords = ride.status === 'Open' ? pickupCords : destCords;
      const isDriverNearby = isNearby(driverLocation, cords, arrivedRadiusInMts);
      if (isDriverNearby && routeState === null) {
        configRoute(cords);
      }
    }
  }, [driverLocation, ride?._id, ride?.status, ride?.hasReachedDestination]);

  async function configRoute(cords: Cords) {
    if (!driverLocation || !ride) return;
    try {
      if (ride.status === 'Active') {
        if (cancelStep !== null) setCancelStep(null);
        if (ride.hasReachedDestination === false) {
          try {
            await hasReachedDestination({ driverId: driverId, rideId: ride._id });
          } catch (error: any) {
            console.log(`error: ${error}`);
            showToast({
              type: 'error',
              title: 'Error',
              description: 'Failed to update destination reached status',
            });
          }
        }
      } else {
        const route = await fetchRoute(driverLocation, cords);
        setRouteState({
          polyline: route?.polyline ?? [],
          remainingDistance: route?.distance,
          remainingDuration: route?.duration,
        });
      }
    } catch (e) {
      console.log(e);
    }
  }

  useEffect(() => {
    if (!ride || !driverLocation) return;
    fitMap([
      { latitude: ride.pickup.latitude, longitude: ride.pickup.longitude },
      { latitude: ride.destination.latitude, longitude: ride.destination.longitude },
    ]);
  }, [ride]);

  const fitMap = useCallback(
    (extra?: Cords[]) => {
      const coords: Cords[] = [];
      if (driverLocation) coords.push(driverLocation);
      if (extra) coords.push(...extra);
      if (coords.length === 0) return;
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 10, right: 20, bottom: 100, left: 20 },
        animated: true,
      });
    },
    [driverLocation]
  );

  // Action handlers
  const handleDriverArrived = async () => {
    if (!ride) return;
    setLoading('driverArrived');
    try {
      await driverArrived({ rideId: id, driverId });
      setRouteState(null);
      showToast({
        type: 'success',
        title: 'Status updated',
        description: 'Waiting for rider at pickup',
      });
    } catch (error: any) {
      console.log(error);
      showToast({ type: 'error', title: 'Failed', description: error?.data ?? 'Failed to submit' });
    } finally {
      setLoading(null);
    }
  };

  const handleCompleteRide = async () => {
    if (!ride) return;
    setLoading('completing');
    try {
      if (driverLocation === null) throw new Error('Failed to access your location');
      await completeRide({
        driverId,
        rideId: ride._id,
        driverLocation,
      });
      pushToPayments();
      showToast({
        type: 'success',
        title: 'Ride completed',
        description: 'Ride completed successfully.',
      });
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Failed',
        description: e.data ?? 'Failed to complete ride.',
      });
    } finally {
      setLoading(null);
    }
  };

  const pushToPayments = () => {
    router.push({
      pathname: '/ride/payment',
      params: {
        rideId: id.toString(),
      },
    });
  };

  const handleConfirmCancel = async () => {
    setLoading('canceling');
    try {
      if (driverLocation === null) throw new Error('Failed to access your location');
      if (selectedReason === null) throw new Error('Please select a valid reason');
      await cancelRide({
        rideId: id,
        driverId,
        reason: selectedReason,
        driverLocation,
      });
      setCancelStep(null);
      setSelectedReason(null);
      showToast({
        type: 'success',
        title: 'Ride cancelled',
        description: 'The ride has been cancelled.',
      });

      if (canceledRideCharges === null || canceledRideCharges.calculatedFare <= 0) {
        router.replace('/');
        if (router.canDismiss()) router.dismissAll();
      } else {
        pushToPayments();
      }
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Failed',
        description: e.data ?? 'Failed to cancel ride.',
      });
    } finally {
      setLoading(null);
    }
  };

  const calculateCancelRide = async () => {
    if (driverLocation === null || !ride) return;
    setLoading('canceling');
    try {
      const result =
        ride.status !== 'Active'
          ? null
          : await calculateDriverCancelRideCharges({
              id,
              driverLocation,
            });
      setCanceledRideCharges(result);
      setCancelStep('confirm');
    } catch (error) {
      confirm(`error ${error}`);
    } finally {
      setLoading(null);
    }
  };

  useEffect(() => {
    if (!ride || ride.status !== 'Abort') return;
    calculateCancelRide();
  }, [ride?.status]);

  // Guards
  if (ride === undefined || vehicle === undefined || settings === undefined)
    return (
      <View className="absolute inset-0 items-center justify-center bg-background">
        <Loader subtitle="Loading ride details..." />
      </View>
    );

  if (ride === null) return <Redirect href={'/'} />;

  const handleLocateDriver = () => {
    const { address: pickupAddress, ...pickupCords } = ride.pickup;
    const { address: destAddress, ...destCords } = ride.destination;
    fitMap([pickupCords, destCords].filter(Boolean) as Cords[]);
  };

  const isRideOpen = ride.status === 'Open';
  const isDriverArrivedStatus = ride.status === 'Driver Arrived';
  
  const pickupCords = { latitude: ride.pickup.latitude, longitude: ride.pickup.longitude };
  const destCords = { latitude: ride.destination.latitude, longitude: ride.destination.longitude };

  const isDriverNearPickup = driverLocation
    ? isNearby(driverLocation, pickupCords, arrivedRadiusInMts)
    : false;

  const isDriverNearDestination = driverLocation
    ? isNearby(driverLocation, destCords, arrivedRadiusInMts)
    : false;

  const isDestinationReached = ride.hasReachedDestination || isDriverNearDestination;

  const isDriverNearby = routeState?.remainingDistance
    ? routeState.remainingDistance.value < arrivedRadiusInMts
    : isDriverNearPickup;

  const driverChanged = ride.driverId !== driverId;

  const rideCanceled = ride.status === 'Canceled';
  const rideAborted = ride.status === 'Abort';
  const rideCompleted = ride.status === 'Completed';
  const riderCancelReason = ride.rideReasons.find((reason) => reason.driverId === undefined);
  const driverCancelReason = ride.rideReasons.find((reason) => reason.driverId === driverId);

  const cancelReasons = ride.status === 'Active' ? CANCEL_REASONS_AFTER_START : CANCEL_REASONS;

  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          header: (props) => <BasicHeader {...props} />,
          title: 'Current Ride',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: '#f8fafc' },
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700', color: '#0f172a' },
        }}
      />
      {loading && (
        <Loader
          title={
            loading === 'driverArrived'
              ? 'Arrived'
              : loading === 'completing'
                ? 'Completing Ride'
                : loading === 'canceling' && ride.status === 'Active'
                  ? 'Ending Ride'
                  : undefined
          }
          subtitle={
            loading === 'driverArrived'
              ? 'Updating status…'
              : loading === 'completing'
                ? 'Calculating fare…'
                : loading === 'canceling' && ride.status === 'Active'
                  ? 'Calculating fare…'
                  : 'Cancelling ride…'
          }
        />
      )}
      <View
        style={{ height: MAP_HEIGHT }}
        pointerEvents={driverChanged || rideCanceled ? 'none' : 'auto'}>
        {/* Full-screen map */}
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          initialRegion={
            driverLocation
              ? { ...driverLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }
              : { latitude: 28.6139, longitude: 77.209, latitudeDelta: 0.05, longitudeDelta: 0.05 }
          }>
          {driverLocation && vehicle?.class && (
            <DriverMarker location={driverLocation} vehicleClass={vehicle.class} />
          )}
          <Marker
            coordinate={{ latitude: ride.pickup.latitude, longitude: ride.pickup.longitude }}
            anchor={{ x: 0, y: 0.9 }}
            pinColor={colors.pickup}
          />
          <Marker
            coordinate={{
              latitude: ride.destination.latitude,
              longitude: ride.destination.longitude,
            }}
            anchor={{ x: 0, y: 0.9 }}
            pinColor={colors.destination}
          />
        </MapView>
      </View>

      {/* Map controls */}
      <View
        style={{ position: 'absolute', top: 10, left: 10, right: 10 }}
        className="flex-row items-start justify-between"
        pointerEvents="box-none">
        <View pointerEvents="none">
          <Animated.View entering={FadeInUp.springify()}>
            <RouteLegend labelA="Pickup" labelB="Destination" />
          </Animated.View>
        </View>
        <TouchableOpacity
          onPress={() => handleLocateDriver()}
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

      {/* Bottom Sheet */}
      <BottomSheet
        ref={activeSheetRef}
        index={1}
        snapPoints={['23%', '55%']}
        enablePanDownToClose={false}
        backgroundStyle={{ backgroundColor: BottomSheetBackgroundColor, borderRadius: 28 }}
        handleIndicatorStyle={{ backgroundColor: BottomSheetIndicatorColor, width: 40 }}>
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 }}>
          {/* CANCEL FLOW — Step 1: Reason selection */}
          {cancelStep === 'reason' && (
            <Animated.View entering={FadeInUp.duration(280)}>
              {/* Header */}
              <View className="mb-2 flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-red-500/15">
                  <AlertTriangle size={20} color="#ef4444" />
                </View>
                <View>
                  <Text className="text-title text-[17px] font-extrabold tracking-tight">
                    {ride.status === 'Active' ? 'Abort Ride' : 'Cancel Ride'}
                  </Text>
                  <Text className="text-xs text-slate-500">
                    Please select a reason before{' '}
                    {ride.status === 'Active' ? 'aborting' : 'cancelling'}
                  </Text>
                </View>
              </View>

              {/* Reason list */}
              <View className="mb-2 overflow-hidden">
                {cancelReasons.map((reason, idx) => {
                  const selected = selectedReason === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      activeOpacity={0.7}
                      onPress={() => setSelectedReason(reason)}
                      className={`flex-row items-center gap-3 px-4 py-3.5 ${
                        selected ? 'bg-red-500/10' : 'bg-transparent'
                      }`}>
                      {/* Checkbox */}
                      {selected ? (
                        <CheckCircle2 size={20} color="#ef4444" />
                      ) : (
                        <Circle size={20} color="#475569" />
                      )}
                      <Text
                        className={`flex-1 text-sm font-semibold ${
                          selected ? 'text-red-400' : 'text-slate-800'
                        }`}>
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Action buttons */}
              <View className="flex-row gap-3">
                <Button
                  disabled={loading === 'canceling'}
                  onPress={() => {
                    setCancelStep(null);
                    setSelectedReason(null);
                  }}
                  className="flex-1 border-primary/90">
                  <Text className="text-[15px] font-bold text-slate-200">← Back</Text>
                </Button>
                <Button
                  disabled={selectedReason === null || loading === 'canceling'}
                  onPress={() => calculateCancelRide()}
                  className={`flex-1 ${
                    selectedReason === null
                      ? 'border-red-900/40 bg-red-900/20'
                      : 'border-red-500/60 bg-red-500/20'
                  }`}>
                  <Text
                    className={`text-[15px] font-extrabold ${
                      selectedReason === null ? 'text-red-900' : 'text-red-400'
                    }`}>
                    Continue →
                  </Text>
                </Button>
              </View>
            </Animated.View>
          )}

          {/* CANCEL FLOW — Step 2: Confirm + fare summary */}
          {cancelStep === 'confirm' && (
            <Animated.View entering={FadeInUp.duration(280)}>
              {/* Header */}
              <View className="mb-3 flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-red-500/15">
                  <AlertTriangle size={20} color="#ef4444" />
                </View>
                {rideAborted ? (
                  <View>
                    <Text className="text-title text-[17px] font-extrabold tracking-tight">
                      Ride Aborted by Rider
                    </Text>
                    <Text className="text-xs text-slate-500">
                      {`Review the trip summary before and \n proceed to payment.`}
                    </Text>
                  </View>
                ) : (
                  <View>
                    <Text className="text-title text-[17px] font-extrabold tracking-tight">
                      Confirm Cancellation
                    </Text>
                    <Text className="text-xs text-slate-500">
                      Review the trip summary before aborting
                    </Text>
                  </View>
                )}
              </View>

              {/* Trip stats card */}
              {canceledRideCharges &&
                ride.status !== 'Open' &&
                ride.status !== 'Driver Arrived' && (
                  <View className="mb-3 overflow-hidden rounded-2xl border border-slate-700/70">
                    {/* Covered */}
                    <View className="flex-row items-center justify-between px-5 pt-4">
                      <View className="flex-row items-center gap-2.5">
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
                          <MaterialCommunityIcons
                            name="map-marker-check"
                            size={16}
                            color="#10b981"
                          />
                        </View>
                        <View>
                          <Text className="font-lighter text-xs text-primary/50">
                            Distance Covered
                          </Text>
                          <Text className="font-lighter text-xs text-primary/50">
                            Remaining Distance
                          </Text>
                        </View>
                      </View>
                      <View>
                        <Text className="font-lighter text-right text-xs text-emerald-400">
                          {distanceFormat(canceledRideCharges.chargableDistance)}
                        </Text>
                        <Text className="font-lighter text-right text-xs text-amber-400">
                          {distanceFormat(canceledRideCharges.remainingDistance)}
                        </Text>
                      </View>
                    </View>

                    {/* Cancellation fare */}
                    <View className="px-5 py-4">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2.5">
                          <View className="h-8 w-8 items-center justify-center rounded-full bg-red-500/15">
                            <MaterialCommunityIcons name="currency-inr" size={16} color="#ef4444" />
                          </View>
                          <View>
                            <Text className="pb-0.5 text-sm font-semibold">Calculated Fare</Text>
                            <View className="hidden flex-row justify-between gap-2">
                              <View className="gap-1">
                                <Text className="text-[10px] text-slate-600/60">Rate/Km</Text>
                                <Text className="text-[10px] text-slate-600">
                                  {formatFare(canceledRideCharges.ratePerKm)}
                                </Text>
                              </View>
                              <View className="gap-1">
                                <Text className="text-[10px] text-slate-600/60">Base Dist.</Text>
                                <Text className="text-[10px] text-slate-600">
                                  {distanceFormat(canceledRideCharges.baseDistance)}
                                </Text>
                              </View>
                              <View className="gap-1">
                                <Text className="text-[10px] text-slate-600/60">Base Fare.</Text>
                                <Text className="text-[10px] text-slate-600">
                                  {formatFare(canceledRideCharges.basePrice)}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                        <Text className="text-2xl font-extrabold tracking-tight text-red-400">
                          {formatFare(canceledRideCharges.calculatedFare)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

              {/* Selected reasons recap */}
              {ride.status === 'Abort' ? (
                <>
                  {riderCancelReason && (
                    <View className="mb-3 rounded-2xl border border-slate-800/50 px-4 py-3">
                      <Text className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Abort Reason
                      </Text>
                      <View key={id} className="mb-1 flex-row items-center gap-2">
                        <View className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        <Text className="text-xs font-medium text-slate-400">
                          {riderCancelReason?.reason}
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <View className="mb-3 rounded-2xl border border-slate-800/50 px-4 py-3">
                  <Text className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {ride.status === 'Driver Arrived' || ride.status === 'Active'
                      ? 'Abort Reason'
                      : 'Cancellation Reason'}
                  </Text>
                  <View key={id} className="mb-1 flex-row items-center gap-2">
                    <View className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    <Text className="text-xs font-medium text-slate-400">{selectedReason}</Text>
                  </View>
                </View>
              )}

              {/* Action buttons */}
              {ride.status === 'Abort' ? (
                <Button
                  onPress={pushToPayments}
                  className="min-h-[52px] flex-1 items-center justify-center rounded-2xl">
                  <Text className="text-[15px] font-bold">Continue →</Text>
                </Button>
              ) : (
                <View className="flex-row gap-3">
                  <Button
                    onPress={() => setCancelStep('reason')}
                    className="min-h-[52px] flex-1 items-center justify-center rounded-2xl">
                    <Text className="text-[15px] font-bold">← Back</Text>
                  </Button>

                  <Button
                    disabled={loading === 'canceling'}
                    onPress={handleConfirmCancel}
                    className="min-h-[52px] flex-1 items-center justify-center rounded-2xl border-2 border-red-500/60 bg-red-500/15">
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="stop-circle-outline" size={18} color="#ef4444" />
                      <Text className="text-[15px] font-extrabold text-red-400">
                        {ride.status === 'Open' ? 'Cancel Ride' : 'Abort Ride'}
                      </Text>
                    </View>
                  </Button>
                </View>
              )}

              {/* Disclaimer */}
              <Text className="mt-3 text-center text-[11px] leading-4 text-slate-600">
                Fare will be charged based on distance covered.{'\n'}
                {ride.status !== 'Abort'
                  ? 'Repeated cancellations may affect your driver rating.'
                  : ''}
              </Text>
            </Animated.View>
          )}

          {/* NORMAL RIDE VIEW */}
          {cancelStep === null && (
            <Animated.View entering={FadeInUp.duration(250)}>
              {rideAborted && driverCancelReason ? (
                <View className="gap-5">
                  {/* Icon + Header */}
                  <View className="items-center gap-3 py-4">
                    <View className="h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/15">
                      <Text className="text-3xl">🚫</Text>
                    </View>
                    <View className="items-center gap-1">
                      <Text className="text-[11px] font-bold uppercase tracking-[0.15em] text-red-400">
                        Ride Aborted
                      </Text>
                      <Text className="text-title text-center text-[20px] font-extrabold tracking-tight">
                        You cancelled this ride
                      </Text>
                    </View>
                  </View>

                  <View className="mb-5 rounded-2xl border border-slate-800/50 px-4 py-3">
                    <Text className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {' '}
                      Abort Reason{' '}
                    </Text>
                    <View key={id} className="mb-1 flex-row items-center gap-2">
                      <View className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      <Text className="text-xs font-medium text-slate-400">
                        {driverCancelReason.reason}
                      </Text>
                    </View>
                  </View>
                  <Button
                    onPress={pushToPayments}
                    className="min-h-[52px] flex-1 items-center justify-center rounded-2xl">
                    <Text className="text-[15px] font-bold">Continue →</Text>
                  </Button>
                </View>
              ) : rideAborted && riderCancelReason ? (
                <View className="gap-5">
                  {/* Icon + Header */}
                  <View className="items-center gap-3 py-4">
                    <View className="h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/15">
                      <Text className="text-3xl">🚫</Text>
                    </View>
                    <View className="items-center gap-1">
                      <Text className="text-[11px] font-bold uppercase tracking-[0.15em] text-red-400">
                        Ride Aborted
                      </Text>
                      <Text className="text-center text-[20px] font-extrabold tracking-tight text-white">
                        Rider cancelled this ride
                      </Text>
                    </View>
                  </View>
                  <View className="mb-5 rounded-2xl border border-slate-800/50 px-4 py-3">
                    <Text className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {' '}
                      Abort Reason{' '}
                    </Text>
                    <View key={id} className="mb-1 flex-row items-center gap-2">
                      <View className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      <Text className="text-xs font-medium text-slate-400">
                        {riderCancelReason.reason}
                      </Text>
                    </View>
                  </View>
                  <Button
                    onPress={pushToPayments}
                    className="min-h-[52px] flex-1 items-center justify-center rounded-2xl">
                    <Text className="text-[15px] font-bold">Continue →</Text>
                  </Button>
                </View>
              ) : rideCompleted ? (
                <View className="gap-4">
                  <View className="flex-row items-center justify-center gap-2">
                    <View className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <Text className="text-center text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-400">
                      Ride Completed
                    </Text>
                  </View>

                  {/* Heading */}
                  <Text className="text-title text-center text-[22px] font-extrabold leading-snug tracking-tight">
                    You've reached the{'\n'}destination 🎉
                  </Text>

                  {/* Completion Card */}
                  <View className="rounded-2xl border border-emerald-500/20 px-4 py-4">
                    <Text className="text-sm font-medium leading-relaxed text-slate-400">
                      Great job! The ride has been completed successfully. Proceed to review payment
                      details.
                    </Text>
                  </View>

                  <Button
                    onPress={pushToPayments}
                    className="min-h-[54px] flex-1 items-center justify-center rounded-2xl bg-emerald-500">
                    <Text className="text-[15px] font-bold text-white">Continue to Payment →</Text>
                  </Button>
                </View>
              ) : (
                <View>
                  {/* Status banner */}
                  <RideStatusBanner ride={ride} />

                  {/* Rider + fare */}
                  <View className="my-2 flex-row items-center justify-between">
                    <View className="flex-1 flex-row items-center gap-3">
                      <View className="h-14 w-14 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/20 p-0.5">
                        <Avatar alt="Profile pic" className="h-12 w-12">
                          <AvatarImage
                            source={
                              ride.rider.details.profilePictureKey
                                ? { uri: ride.rider.details.profilePictureKey }
                                : require('@/assets/images/avatar.jpg')
                            }
                          />
                          <AvatarFallback className="bg-white/20">
                            <Text className="text-2xl font-bold text-primary">
                              {ride.rider.details.firstName[0].toUpperCase() ?? 'R'}
                            </Text>
                          </AvatarFallback>
                        </Avatar>
                      </View>
                      <View className="flex-1">
                        <Text
                          numberOfLines={2}
                          ellipsizeMode="tail"
                          className="text-title mb-0.5 text-[22px] font-extrabold tracking-tight">
                          {`${ride.rider.details.firstName ?? ''} ${ride.rider.details?.lastName ?? ''}`.trim() ||
                            'Rider'}
                        </Text>
                        <GenderAge
                          gender={ride.rider.details.gender}
                          dob={ride.rider.details.dob}
                        />
                        {ride.rider.ratings?.average != null && (
                          <View className="mt-0.5 flex-row items-center gap-1">
                            <Text className="text-xs text-amber-400">★</Text>
                            <Text className="text-xs font-semibold text-slate-400">
                              {ride.rider.ratings.average.toFixed(1)}
                            </Text>
                            <Text className="text-xs text-slate-600">
                              ({ride.rider.ratings.totalRatings})
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View className="ml-3 items-end">
                      <Text className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        Est. Fare
                      </Text>
                      <Text className="text-2xl font-extrabold tracking-tight text-emerald-600">
                        {formatFare(ride.fare)}
                      </Text>
                    </View>
                  </View>

                  <RouteCard pickup={ride.pickup} destination={ride.destination} />

                  <View className="my-2 flex-row items-center justify-between gap-2">
                    {/* Arrived button */}
                    {isRideOpen && isDriverNearby && (
                      <View className="flex-1">
                        <Button
                          className="flex-row items-center justify-center gap-2 rounded-2xl border-2 border-primary/90 bg-primary"
                          disabled={loading === 'driverArrived'}
                          onPress={handleDriverArrived}>
                          <MapPinCheck size={20} color="#fff" />
                          <Text className="text-[17px] font-bold tracking-tight text-white">
                            I've Arrived
                          </Text>
                        </Button>
                      </View>
                    )}

                    {/* Start Ride button */}
                    {isDriverArrivedStatus && (
                      <View className="flex-1">
                        <Button
                          className="items-center justify-center rounded-2xl border-2 border-emerald-500 bg-emerald-600"
                          disabled={loading === 'starting'}
                          onPress={() =>
                            router.push({
                              pathname: '/ride/startRide',
                              params: { driverId, rideId: id },
                            })
                          }>
                          <Text className="text-[17px] font-extrabold tracking-tight text-white">
                            ▶ Start Ride
                          </Text>
                        </Button>
                      </View>
                    )}

                    {/* Complete / Cancel */}
                    <View className="flex-1">
                      {isDestinationReached && ride.status === 'Active' ? (
                        <Button
                          className="items-center justify-center rounded-2xl border-2 border-primary/90 bg-primary"
                          disabled={loading === 'completing'}
                          onPress={handleCompleteRide}>
                          <Text className="text-[17px] font-extrabold tracking-tight text-white">
                            {loading === 'completing' ? 'Completing…' : '✓ Complete Ride'}
                          </Text>
                        </Button>
                      ) : (
                        <Button
                          onPress={() => setCancelStep('reason')}
                          disabled={loading === 'canceling'}
                          variant="destructive"
                          className="flex-row items-center justify-center gap-2 rounded-2xl border-2 border-red-200 bg-red-50">
                          <Ionicons name="close-circle-outline" size={20} color="#dc2626" />
                          <Text className="text-sm font-semibold text-red-600">
                            {ride.status === 'Active' ? 'End Ride' : 'Cancel Ride'}
                          </Text>
                        </Button>
                      )}
                    </View>
                  </View>
                </View>
              )}
              ;
            </Animated.View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
      {driverChanged && <DriverChangedAlert />}
      {rideCanceled && <RideCanceled riderCancelReason={riderCancelReason} />}
    </View>
  );
}

function DriverChangedAlert() {
  return (
    <AlertDialog defaultOpen>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">Ride Reassigned</AlertDialogTitle>

          <AlertDialogDescription>
            This ride has been reassigned to another driver by the rider. You will no longer receive
            updates for this trip. Return to the home screen to view new ride requests.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-row">
          <AlertDialogAction
            className="w-full"
            onPress={() => {
              router.back();
            }}>
            <Text className="text-center text-white">Back to Ride Requests</Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RideCanceled({
  riderCancelReason,
}: {
  riderCancelReason: Ride['rideReasons'][number] | undefined;
}) {
  return (
    <AlertDialog defaultOpen>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">Ride Canceled</AlertDialogTitle>

          {riderCancelReason && (
            <View className="flex-row gap-1 rounded-xl bg-destructive/10 p-2">
              <Text>Reason:</Text>
              <Text className="font-bold text-destructive">{riderCancelReason.reason}</Text>
            </View>
          )}

          <AlertDialogDescription>
            The rider has canceled this ride request. You will no longer receive updates for this
            trip. Return to the home screen to view new ride requests.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-row">
          <AlertDialogAction
            className="w-full"
            onPress={() => {
              router.back();
            }}>
            <Text className="text-center text-white">Back to Ride Requests</Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
