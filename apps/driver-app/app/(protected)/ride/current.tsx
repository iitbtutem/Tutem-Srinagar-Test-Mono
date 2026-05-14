import { Text } from '@/components/ui/text';
import { api, Id } from '@tutem/api';
import { useQuery, useAction, useMutation } from 'convex/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Linking, Platform, Dimensions } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useColorScheme } from 'nativewind';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/CustomToast';
import { router, useLocalSearchParams, useRouter } from 'expo-router';
import { fetchRoute } from '@/lib/maps';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { distanceFormat, formatFare, getTimeBetweenFormatted, isNearby } from '@/lib/utils';
import useThemeColors from '@/hooks/useColorScheme';
import DriverMarker from '@/components/DriverMarker';
import { ARRIVED_RADIUS_IN_MTS } from '@/constants';
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
} from '@/components/ui/alert-dialog';
import { FunctionReturnType } from 'convex/server';
import Gender from '@/components/Gender';
import Age from '@/components/Age';

// Types

type Ride = NonNullable<FunctionReturnType<typeof api.routes.rides.getRide>>;

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

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Map takes ~62% of screen height in the scrollable layout
const MAP_HEIGHT = Math.round(SCREEN_HEIGHT * 0.35);

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

const CANCEL_REASONS = [
  'Rider at wrong location',
  'Safety concern with rider',
  'Vehicle breakdown / issue',
  'Personal emergency',
  'Other reason',
];

export default function Ride() {
  const { id, driverId } = useLocalSearchParams<{ id: Id<'ride'>; driverId: Id<'driver'> }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { BottomSheetBackgroundColor, BottomSheetIndicatorColor } = useThemeColors();
  const { colorScheme: currentTheme } = useColorScheme();
  const isDark = currentTheme === 'dark';

  const [routeState, setRouteState] = useState<RouteState | null>(null);
  const [loading, setLoading] = useState<
    'driverArrived' | 'starting' | 'completing' | 'canceling' | null
  >(null);

  // Cancel flow state
  const [cancelStep, setCancelStep] = useState<CancelStep | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>("");
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

  const ride = useQuery(api.routes.rides.getRide, id ? { id } : 'skip');
  const driverArrived = useAction(api.actions.ride.driverArrived);
  const completeRide = useAction(api.actions.ride.completeRide);
  const cancelRide = useAction(api.actions.ride.driverCancelRide);
  const calculateDriverCancelRideCharges = useAction(api.actions.ride.calculateDriverCancelRideCharges);
  const hasReachedDestination = useMutation(api.routes.rides.hasReachedDestination)
  const vehicle = useQuery(api.routes.vehicle.getVehicleByDriverId, ride ? { driverId } : 'skip');

  // Map / route logic
  useEffect(() => {
    if (!driverLocation) return;
    mapRef.current?.animateToRegion(
      { ...driverLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 },
      1000
    );
    if (!ride) return;
    const pickupCords = { latitude: ride.pickup.latitude, longitude: ride.pickup.longitude };
    const destCords = {
      latitude: ride.destination.latitude,
      longitude: ride.destination.longitude,
    };
    const cords: Cords = ride.status === 'Open' ? pickupCords : destCords;
    const isDriverNearby = isNearby(driverLocation, cords, ARRIVED_RADIUS_IN_MTS);
    if (isDriverNearby && routeState === null) configRoute(cords);
  }, [driverLocation, ride]);

  async function configRoute(cords: Cords) {
    if (!driverLocation || !ride) return;
    try {
      const route = await fetchRoute(driverLocation, cords);
      setRouteState({
        polyline: route?.polyline ?? [],
        remainingDistance: route?.distance,
        remainingDuration: route?.duration,
      });
      if (route?.distance.value < ARRIVED_RADIUS_IN_MTS) {
        if(cancelStep !== null) setCancelStep(null);
        if(ride.status === "Active" && ride.hasReachedDestionation === false){
          try {
            await hasReachedDestination({ driverId: driverId, rideId: ride._id })
          } catch (error: any) {
            console.log(`error: ${error}`);
            showToast({
              type: "error",
              title: "Error",
              description: "Failed to update destination reached status"
            })
          }
        }
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
        edgePadding: { top: 10, right: 60, bottom: 80, left: 20 },
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

  const handleCompleteRide = async (driverId: Id<'driver'>, rideId: Id<'ride'>) => {
    if(!ride) return;
    try {
      if(driverLocation === null) throw new Error("Failed to access your location")
      const result = await completeRide({ driverId, rideId, driverLocation });
      router.push({
        pathname: '/ride/payment',
        params: {
          rideId: rideId.toString(),
          driverId: driverId.toString(),
          rideDistance: result?.distance ?? ride.distance,
          fare: result?.fare ?? ride.fare,
          duration: (ride.startedAt && ride.completedAt) ? getTimeBetweenFormatted(new Date(ride.startedAt), new Date(ride.completedAt)) : "-",
        },
      });
      showToast({
        type: 'success',
        title: 'Ride completed',
        description: 'Ride completed successfully.',
      });
      activeSheetRef.current?.close();
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Failed',
        description: e.data ?? 'Failed to complete ride.',
      });
    }
  };

  const pushToPayments = () => {
    if (canceledRideCharges === null) return;
    if(router.canDismiss()) router.dismissAll();
    if(canceledRideCharges.calculatedFare <= 0 ){
      router.replace("/")
    } else {
      router.replace({
        pathname: "/ride/payment",
        params: {
          rideId: id,
          driverId: driverId,
          rideDistance: canceledRideCharges.chargableDistance,
          fare: canceledRideCharges.calculatedFare,
          duration: 0
        }
      })
    }
  }

  const handleConfirmCancel = async () => {
    setLoading('canceling');
    try {
      if(driverLocation === null) throw new Error("Failed to access your location")
      await cancelRide({
        rideId: id,
        driverId,
        reason: selectedReason,
        driverLocation
      });
      setCancelStep(null);
      setSelectedReason("");
      showToast({
        type: 'success',
        title: 'Ride cancelled',
        description: 'The ride has been cancelled.',
      });

      pushToPayments();
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
    if (driverLocation === null) return;
    setLoading("canceling")
    try {
      const result = await calculateDriverCancelRideCharges({ id, driverLocation });
      setCanceledRideCharges(result);
      setCancelStep('confirm');
    } catch (error) {
      confirm(`error ${error}`);
    } finally {
      setLoading(null)
    }
  };

  useEffect(() => {
    if(!ride || ride.status !== "Abort") return;
    calculateCancelRide();
  }, [ride?.status])

  // Guards
  if (ride === undefined || vehicle === undefined)
    return (
      <View className="absolute inset-0 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="purple" />
        <Text className="mt-3 text-sm font-medium text-purple-800">Loading…</Text>
      </View>
    );
  if (ride === null) return null;  

  const handleLocateDriver = () => {
    const { address: pickupAddress, ...pickupCords } = ride.pickup;
    const { address: destAddress, ...destCords } = ride.destination;
    fitMap([pickupCords, destCords].filter(Boolean) as Cords[])
  }

  const isRideOpen = ride.status === 'Open';
  const isDriverArrivedStatus = ride.status === 'Driver Arrived';
  const isActive = ride.status === 'Active';
  const isDriverNearby = routeState
    ? routeState.remainingDistance.value < ARRIVED_RADIUS_IN_MTS
    : false;

  const driverChanged = ride.driverId !== driverId;

  const rideCanceled = ride.status === "Canceled"
  const cancelReason = ride.rideReasons.find(reason => reason.driverId === undefined);

  return (
    <View className="flex-1">
      <View className="flex-1 " style={{ height: MAP_HEIGHT }} pointerEvents={driverChanged ? 'none' : 'auto'}>
        {/* Full-screen map */}
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
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
            pinColor="green"
          />
          <Marker
            coordinate={{
              latitude: ride.destination.latitude,
              longitude: ride.destination.longitude,
            }}
            anchor={{ x: 0, y: 0.9 }}
            pinColor="red"
          />
        </MapView>

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
          snapPoints={['40%', '85%']}
          enablePanDownToClose={false}
          backgroundStyle={{ backgroundColor: BottomSheetBackgroundColor, borderRadius: 28 }}
          handleIndicatorStyle={{ backgroundColor: BottomSheetIndicatorColor, width: 40 }}>
          <BottomSheetScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 }}>
            {/* CANCEL FLOW — Step 1: Reason selection */}
            {cancelStep === 'reason' && (
              <Animated.View entering={FadeInUp.duration(280)}>
                {/* Header */}
                <View className="mb-5 flex-row items-center gap-3">
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
                <View className="mb-5 overflow-hidden">
                  {CANCEL_REASONS.map((reason, idx) => {
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
                    disabled={ loading === "canceling"}
                    onPress={() => {
                      setCancelStep(null);
                      setSelectedReason("");
                    }}
                    className="flex-1 border-primary/90">
                    <Text className="text-[15px] font-bold text-slate-200">← Back</Text>
                  </Button>
                  <Button
                    disabled={selectedReason === null || loading === "canceling"}
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
                      Continue {loading === "canceling" ? "…" : "→"}
                    </Text>
                  </Button>
                </View>
              </Animated.View>
            )}

            {/* CANCEL FLOW — Step 2: Confirm + fare summary */}
            {cancelStep === 'confirm' && (
              <Animated.View entering={FadeInUp.duration(280)}>
                {/* Header */}
                <View className="mb-5 flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-red-500/15">
                    <AlertTriangle size={20} color="#ef4444" />
                  </View>
                  {ride.status === "Abort" ? (
                    <View>
                      <Text className="text-title text-[17px] font-extrabold tracking-tight">
                        Ride Aborted by Rider
                      </Text>
                      <Text className="text-xs text-slate-500">
                        Review the trip summary before and proceed to payment.
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
                {canceledRideCharges && <View className="mb-5 overflow-hidden rounded-2xl border border-slate-700/70">
                  {/* Covered */}
                  <View className="flex-row items-center justify-between border-b border-slate-800/60 px-5 py-4">
                    <View className="flex-row items-center gap-2.5">
                      <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
                        <MaterialCommunityIcons name="map-marker-check" size={16} color="#10b981" />
                      </View>
                      <Text className="text-sm font-semibold">Distance Covered</Text>
                    </View>
                    <Text className="text-base font-extrabold text-emerald-400">
                      {distanceFormat(ride.distance - canceledRideCharges.remainingDistance)}
                    </Text>
                  </View>

                  {/* Remaining */}
                  <View className="flex-row items-center justify-between border-b border-slate-800/60 px-5 py-4">
                    <View className="flex-row items-center gap-2.5">
                      <View className="h-8 w-8 items-center justify-center rounded-full bg-amber-500/15">
                        <MaterialCommunityIcons
                          name="map-marker-distance"
                          size={16}
                          color="#f59e0b"
                        />
                      </View>
                      <Text className="text-sm font-semibold">
                        Remaining Distance
                      </Text>
                    </View>
                    <Text className="text-base font-extrabold text-amber-400">
                      {distanceFormat(canceledRideCharges.remainingDistance)}
                    </Text>
                  </View>

                  {/* Cancellation fare */}
                  <View className="px-5 py-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2.5">
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-red-500/15">
                          <MaterialCommunityIcons name="currency-inr" size={16} color="#ef4444" />
                        </View>
                        <View className='gap-2'>
                          <Text className="text-sm font-semibold">
                            Cancellation Fare
                          </Text>
                          <View className="flex-row justify-between gap-2">
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
                </View>}

                {/* Selected reasons recap */}
                <View className="mb-5 rounded-2xl border border-slate-800/50 px-4 py-3">
                  <Text className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    { (ride.status === "Abort" || ride.status === "Driver Arrived" || ride.status === "Active")
                    ? "Aborting Reason"
                    : "Cancellation Reason"}
                  </Text>
                  <View key={id} className="mb-1 flex-row items-center gap-2">
                    <View className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    <Text className="text-xs font-medium text-slate-400">{selectedReason}</Text>
                  </View>
                </View>

                {/* Action buttons */}
                { ride.status === "Abort" ? (
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
                      {loading === 'canceling' ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="stop-circle-outline" size={18} color="#ef4444" />
                          <Text className="text-[15px] font-extrabold text-red-400">Abort Ride</Text>
                        </View>
                      )}
                    </Button>
                  </View>
                )}

                {/* Disclaimer */}
                <Text className="mt-4 text-center text-[11px] leading-4 text-slate-600">
                  Fare will be charged based on distance covered.{'\n'}
                  { ride.status !== "Abort" ? "Repeated cancellations may affect your driver rating." : ""}
                </Text>
              </Animated.View>
            )}

            {/* NORMAL RIDE VIEW */}
            {cancelStep === null && (
              <Animated.View entering={FadeInUp.duration(250)}>
                {/* Status banner */}
                <RideStatusBanner ride={ride} />

                {/* Rider + fare */}
                <View className="mb-4 flex-row items-center justify-between border-b border-slate-800/60 pb-4">
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
                      <Text className="text-title text-base font-bold" numberOfLines={1}>
                        {`${ride.rider.details.firstName ?? ''} ${ride.rider.details?.lastName ?? ''}`.trim() ||
                          'Rider'}
                      </Text>
                      <Gender gender={ride.rider.details.gender} />
                      <Age dob={ride.rider.details.dob} />
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

                {/* Arrived button */}
                {isRideOpen && isDriverNearby && (
                  <Button
                    className="mb-2 w-full flex-row items-center justify-center gap-2 rounded-2xl border-2 border-primary/90 bg-primary"
                    disabled={loading === 'driverArrived'}
                    onPress={handleDriverArrived}>
                    <MapPinCheck size={20} color="#fff" />
                    <Text className="text-[17px] font-bold tracking-tight text-white">
                      {loading === 'driverArrived' ? 'Notifying Rider…' : "I've Arrived"}
                    </Text>
                  </Button>
                )}

                {/* Start Ride button */}
                {isDriverArrivedStatus && (
                  <Button
                    className="my-2 w-full items-center justify-center rounded-2xl border-2 border-emerald-500 bg-emerald-600"
                    disabled={loading === 'starting'}
                    onPress={() =>
                      router.push({
                        pathname: '/ride/startRide',
                        params: { driverId, rideId: id },
                      })
                    }>
                    <Text className="text-[17px] font-extrabold tracking-tight text-white">
                      {loading === 'starting' ? 'Starting…' : '▶ Start Ride'}
                    </Text>
                  </Button>
                )}

                {/* Complete / Cancel */}
                {ride.hasReachedDestionation ? (
                  <Button
                    className="my-2 w-full items-center justify-center rounded-2xl border-2 border-primary/90 bg-primary"
                    disabled={loading === 'completing'}
                    onPress={() => handleCompleteRide(driverId, ride._id)}>
                    <Text className="text-[17px] font-extrabold tracking-tight text-white">
                      {loading === 'completing' ? 'Completing…' : '✓ Complete Ride'}
                    </Text>
                  </Button>
                ) : (
                  <Button
                    onPress={() => setCancelStep('reason')}
                    disabled={loading === 'canceling'}
                    variant="destructive"
                    className="my-2 flex-row items-center justify-center gap-2 rounded-2xl border-2 border-red-200 bg-red-50">
                    {loading === 'canceling' ? (
                      <ActivityIndicator size="small" color="#dc2626" />
                    ) : (
                      <Ionicons name="close-circle-outline" size={20} color="#dc2626" />
                    )}
                    <Text className="text-sm font-semibold text-red-600">
                      {loading === 'canceling'
                        ? ride.status === 'Active'
                          ? 'Ending…'
                          : 'Cancelling…'
                        : ride.status === 'Active'
                          ? 'End Ride'
                          : 'Cancel Ride Request'}
                    </Text>
                  </Button>
                )}

                {/* Route address card */}
                <View className="bg-primary-background my-4 mb-4 rounded-2xl border border-slate-800 p-4">
                  <View className="mb-4 flex-row items-start gap-3">
                    <View className="mt-1 items-center">
                      <View className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                      <View className="mt-1 h-6 w-px bg-slate-700" />
                    </View>
                    <View className="flex-1">
                      <TouchableOpacity
                        onPress={() => openNavigation(ride.pickup.latitude, ride.pickup.longitude)}
                        activeOpacity={0.75}
                        className="flex-1">
                        <Text className="mb-0.5 text-[10px] font-bold uppercase tracking-[1.5px] text-teal-400">
                          Pickup
                        </Text>
                        <Text className="text-title text-[14px] font-semibold leading-5">
                          {ride.pickup?.address ?? 'Pickup not set'}
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
                          openNavigation(ride.destination.latitude, ride.destination.longitude)
                        }
                        activeOpacity={0.75}
                        className="flex-1">
                        <Text className="mb-0.5 text-[10px] font-bold uppercase tracking-[1.5px] text-violet-400">
                          Destination
                        </Text>
                        <Text className="text-title text-[14px] font-semibold leading-5">
                          {ride.destination?.address ?? 'Destination not set'}
                        </Text>
                        <Text className="text-xs font-bold text-violet-400">Navigate →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Animated.View>
            )}
          </BottomSheetScrollView>
        </BottomSheet>
      </View>
      {driverChanged && <DriverChangedAlert />}
      {rideCanceled && <RideCanceled cancelReason={cancelReason} />}
    </View>
  );
};

function DriverChangedAlert() {
  return (
    <AlertDialog defaultOpen>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            Ride Reassigned
          </AlertDialogTitle>

          <AlertDialogDescription>
            This ride has been reassigned to another driver by the rider. 
            You will no longer receive updates for this trip. Return to the 
            home screen to view new ride requests.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-row">
          <AlertDialogAction
            className="w-full"
            onPress={() => {
              router.push("/");
            }}
          >
            <Text className="text-center text-white">
              Back to Ride Requests
            </Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RideCanceled({
  cancelReason,
}: {
  cancelReason: Ride["rideReasons"][number] | undefined;
}) {
  return (
    <AlertDialog defaultOpen>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            Ride Canceled
          </AlertDialogTitle>

          {cancelReason && (
            <View className="flex-row gap-1 rounded-xl bg-destructive/10 p-2">
              <Text>Reason:</Text>
              <Text className="font-bold text-destructive">
                {cancelReason.reason}
              </Text>
            </View>
          )}

          <AlertDialogDescription>
            The rider has canceled this ride request. You will no longer
            receive updates for this trip. Return to the home screen to view
            new ride requests.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-row">
          <AlertDialogAction
            className="w-full"
            onPress={() => {
              router.push("/");
            }}
          >
            <Text className="text-center text-white">
              Back to Ride Requests
            </Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
