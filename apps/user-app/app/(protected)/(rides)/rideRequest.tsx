import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { Ionicons, MaterialIcons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { api, Id } from '@tutem/api';
import { useQuery, useAction } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { View, ScrollView, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { getDriverChannel } from '@/lib/ably';
import { fetchRoute } from '@/lib/maps';
import { useColorScheme } from 'nativewind';
import ErrorScreen from '@/components/ErrorScreen';
import PulseDot from '@/components/PulseDot';
import LiveTimer from '@/components/LiveTimer';
import * as Location from 'expo-location';
import { mapStyle } from '@/constants/mapStyles';
import { VERIFICATION_CONFIG } from '@/constants/colors';
import BottomSheet from '@gorhom/bottom-sheet';
import { useSharedValue } from 'react-native-reanimated';
import NearbyDrivers from '@/components/NearbyDrivers';
import SheetLayer from '@/components/BottomSheetLayer';
import { FunctionReturnType } from 'convex/server';
import { VEHICLE_CLASS } from '../../../../../packages/api/convex/CONSTANTS';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/CustomToast';
import { distanceFormat } from '../../../../driver-app/lib/utils';
import { Separator } from '@/components/ui/seperator';
import useThemeColors from '@/hooks/useColorScheme';

// types

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

// NearbyDrivers
type NearbyDriver = FunctionReturnType<typeof api.routes.actions.getNearbyDrivers>[number];

type VehicleClass = (typeof VEHICLE_CLASS)[number];
// helpers

function getVehicleIcon(type: string): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  switch (type) {
    case 'Bike':
      return 'motorbike';
    case 'Auto':
      return 'rickshaw';
    case 'Hatchback':
    case 'Sedan':
      return 'car-side';
    case 'Suv':
      return 'car-estate';
    default:
      return 'car';
  }
}

function getFuelColor(fuel: string) {
  switch (fuel) {
    case 'EV':
      return { bg: 'bg-emerald-100 bg-emerald-500', text: 'text-emerald-700' };
    case 'Petrol':
      return { bg: 'bg-orange-100 dark:bg-orange-500', text: 'text-orange-700' };
    case 'Diesel':
      return { bg: 'bg-slate-100', text: 'text-slate-600' };
    default:
      return { bg: 'bg-gray-100 bg-gray-500', text: 'text-gray-600' };
  }
}

// sub-components

function InfoPill({ label, color }: { label: string; color: string }) {
  return (
    <View className={`rounded-full px-2.5 py-0.5 ${color}`}>
      <Text className="text-[11px] font-semibold">{label}</Text>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View className="flex-1 items-center gap-0.5 rounded-2xl bg-gray-50 dark:bg-zinc-900 py-3">
      <Ionicons name={icon} size={18} color={highlight ? '#2563eb' : '#6b7280'} />
      <Text className="mt-1 text-[11px] text-gray-400 dark:text-gray-100">{label}</Text>
      <Text className={`text-base font-bold ${highlight ? 'text-blue-600' : 'text-gray-900 dark:text-gray-100'}`}>
        {value}
      </Text>
    </View>
  );
}

// main screen

export default function RideRequest() {
  const { id } = useLocalSearchParams<{ id: Id<'ride'> }>();
  const router = useRouter();
  const  {colorScheme}= useColorScheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { iconColor, BottomSheetBackgroundColor, BottomSheetIndicatorColor, iconBackgroundColor} = useThemeColors();

  const ride = useQuery(api.routes.rides.getRiderCurrentRideById, id ? { id } : 'skip');
  const cancelRide = useAction(api.routes.rideActions.cancelRide);
  const [cancelling, setCancelling] = useState(false);
  const [changingDriver, setChangingDriver] = useState(false);
  const [routeState, setRouteState] = useState<RouteState | null>(null);

  const [riderLocation, setRiderLocation] = useState<Coords | null>(null);

  const [isMapMaximized, setIsMapMaximized] = useState(false);
  
  const [driverLocation, setDriverLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [mainRoute, setMainRoute] = useState<{ latitude: number, longitude: number }[] | null>(null);
  const [approachRoute, setApproachRoute] = useState<{ latitude: number, longitude: number }[] | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<NearbyDriver | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  
  const [filters, setFilters] = useState<VehicleClass[]>([]);
  const [genderMatch, setGenderMatch] = useState(false);

  // Center on driver when location is first received
  const [hasCenteredOnDriver, setHasCenteredOnDriver] = useState(false);

  const [sheetIndex, setSheetIndex] = useState(-1);

  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const animatedIndex = useSharedValue(1);

  const isDark = colorScheme === 'dark';
  
  const getNearbyDriversAction = useAction(api.routes.actions.getNearbyDrivers);
  const changeDriver = useAction(api.routes.rideActions.changeDriver);

  const fetchDrivers = async () => {
    if(!ride) return;
    try {
      const drivers = await getNearbyDriversAction({
        pickup: {
          latitude: ride.pickup.latitude,
          longitude: ride.pickup.longitude,
        },
        destination: {
          latitude: ride.destination.latitude,
          longitude: ride.destination.longitude,
        },
        distance: Number(ride.distance),
        riderId: ride.riderId,
        genderMatch: genderMatch,
        filters: filters,
      });
      setNearbyDrivers(drivers);
    } catch (error) {
      console.error("Discovery error:", error);
      setNearbyDrivers([]);
    }
  };

  const handleCancel = () => {
    if (!ride) return;

    Alert.alert('Cancel Ride?', 'Are you sure you want to cancel this ride request?', [
      { text: 'No, Keep It', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try {
            setCancelling(true);
            router.dismissAll();
            router.replace('/');
            await cancelRide({ rideId: id, riderId: ride.riderId });
          } catch (e) {
            Alert.alert('Error', 'Failed to cancel ride. Please try again.');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const handleShowNearbyDrivers = async () => {
    try {
      await fetchDrivers();
      bottomSheetRef.current?.expand();
    } catch (error) {
      console.log("Error : ", error)
    }
  }

  const handleChangeDriver = async () => {
    if(!ride || !selectedDriver) return;
    setChangingDriver(true);
    try {
      await changeDriver({
        rideId: ride._id,
        riderId: ride.riderId,
        driverId: selectedDriver.driver._id,
      });
      bottomSheetRef.current?.close();
    } catch (error: any) {
      console.log(`Error ${error}`)
      showToast({
        type: "error",
        title: "Failed",
        description: "Failed to change driver"
      })
    } finally {
      setChangingDriver(false);
    }
  }

  useEffect(() => {
    fetchDrivers();
  }, [filters, genderMatch])

  // 1. Fetch Main Route (Pickup -> Destination) once
  useEffect(() => {
    if (ride && !mainRoute) {
      fetchRoute(
        { latitude: ride.pickup.latitude, longitude: ride.pickup.longitude },
        { latitude: ride.destination.latitude, longitude: ride.destination.longitude }
      ).then(route => {
        if (route) setMainRoute(route.polyline);
      });
    }
  }, [ride]);

  // 2. Fetch Approach Route (Driver -> Pickup) dynamically
  // Only if ride is not yet started (Open)
  useEffect(() => {
    if (driverLocation && ride && ride.status === 'Open') {
      fetchRoute(
        driverLocation,
        { latitude: ride.pickup.latitude, longitude: ride.pickup.longitude }
      ).then(route => {
        if (route) setApproachRoute(route.polyline);
      });
    } else if (ride?.status === 'Active') {
      // Clear approach route once ride starts
      setApproachRoute(null);
    }
  }, [driverLocation, ride?.status]);

  useEffect(() => {
    if (!ride?.driver?._id) return;

    console.log('Setting up Ably for driver:', ride.driver._id);

    // Use rewind: '1' to get the last known location immediately
    const channel = getDriverChannel(ride.driver._id, { rewind: '1' });
    console.log("channel is", channel);
    if (!channel) return;

    // 1. Fetch Last Known Location from History (Persisted in Ably)
    // IMPORTANT: Ensure "Persist messages" is enabled in Ably Dashboard Settings
    channel.history({ limit: 1 }).then((resultPage: any) => {
      if (resultPage.items && resultPage.items.length > 0) {
        const lastMessage = resultPage.items[0];
        console.log('Restored location from Ably History:', lastMessage.data);
        setDriverLocation({
          latitude: lastMessage.data.latitude,
          longitude: lastMessage.data.longitude,
        });
      } else {
        console.log('Ably History is empty. If the driver is offline, no location can be shown unless History is enabled in the Ably Dashboard.');
      }
    }).catch((err: any) => {
      console.error('Ably History fetch failed:', err);
    });

    const handleLocationUpdate = (message: any) => {
      console.log('Received Ably location update:', message.data);
      if (message.name === 'location') {
        const coords = {
          latitude: message.data.latitude,
          longitude: message.data.longitude,
        };
        setDriverLocation(coords);
      }
    };

    channel.subscribe('location', handleLocationUpdate);

    return () => {
      channel.unsubscribe('location', handleLocationUpdate);
    };
  }, [ride?.driver?._id]);

  useEffect(() => {
    if (driverLocation && !hasCenteredOnDriver && mapRef.current) {
       mapRef.current.animateToRegion({
        ...driverLocation,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 1000);
      setHasCenteredOnDriver(true);
    }
  }, [driverLocation, hasCenteredOnDriver]);

  // Live GPS
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 15 },
        (loc) =>
          setRiderLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
      );
    })();
    return () => {
      sub?.remove();
    };
  }, []);

  useEffect(() => {
    if (!ride || !riderLocation) return;

    let cancelled = false;

    // wait 2 minutes before firing request
    const timer = setTimeout(
      async () => {
        const pickupCords = {
          latitude: ride.pickup.latitude,
          longitude: ride.pickup.longitude,
        };

        const destCords = {
          latitude: ride.destination.latitude,
          longitude: ride.destination.longitude,
        };

        try {
          const [driven, remaining]: [RouteResult, RouteResult] = await Promise.all([
            fetchRoute(pickupCords, riderLocation),
            fetchRoute(riderLocation, destCords),
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
  }, [riderLocation, ride]);

  if (ride === undefined) return;
  if (ride === null) return <ErrorScreen message="Ride Not found" code="Failed to fetch ride" />;
  
  const vehicle = ride.vehicle;
  const fuelStyle = vehicle ? getFuelColor(vehicle.fuelType) : null;

  const verificationStatus = selectedDriver?.driver?.isLicenseVerified;
  
  const licenseVerification = verificationStatus
    ? VERIFICATION_CONFIG[verificationStatus]
    : VERIFICATION_CONFIG['Pending'];

  return (
    <View className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <SafeAreaView />

{/* Maximized Map Modal/Overlay */}
      {isMapMaximized && (
        <View className="absolute inset-0 z-50 bg-black">
           <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            customMapStyle={colorScheme === 'dark' ? mapStyle.dark : mapStyle.light}
            initialRegion={{
              latitude: ride.pickup.latitude,
              longitude: ride.pickup.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            {/* Main Ride Route (Pickup -> Destination) */}
            {mainRoute && (
              <Polyline
                coordinates={mainRoute}
                strokeWidth={4}
                strokeColor="#6366f1"
              />
            )}

            {/* Approach Route (Driver -> Pickup) - Only shown before ride starts */}
            {approachRoute && (
              <Polyline
                coordinates={approachRoute}
                strokeWidth={3}
                strokeColor="#3b82f6"
                lineDashPattern={[5, 10]}
              />
            )}
            {driverLocation && (
              <Marker 
                coordinate={driverLocation} 
                anchor={{ x: 0.5, y: 0.5 }}
                flat
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-900 border-2 border-blue-500 shadow-lg">
                  <MaterialCommunityIcons name="car-side" size={24} color="#3b82f6" />
                </View>
              </Marker>
            )}
            <Marker coordinate={{ latitude: ride.pickup.latitude, longitude: ride.pickup.longitude }}>
              <View className="h-4 w-4 rounded-full border-2 border-white bg-teal-500 shadow-sm" />
            </Marker>
            <Marker coordinate={{ latitude: ride.destination.latitude, longitude: ride.destination.longitude }}>
              <View className="h-4 w-4 rounded-full border-2 border-white bg-violet-600 shadow-sm" />
            </Marker>
          </MapView>

          <Pressable 
            onPress={() => setIsMapMaximized(false)}
            className="absolute top-12 left-5 h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md"
          >
            <Ionicons name="close" size={24} color="#111827" />
          </Pressable>

          <View className="absolute bottom-10 right-5 gap-3">
             <Pressable 
              onPress={() => {
                if (driverLocation) {
                  mapRef.current?.animateToRegion({
                    ...driverLocation,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  });
                }
              }}
              className="h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg active:bg-gray-50"
            >
              <MaterialIcons name="my-location" size={24} color="#3b82f6" />
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        className={cn("flex-1", { "pointer-events-none" : sheetIndex !== -1 })}
        contentContainerClassName="px-4 pb-12"
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center py-4">
          <Pressable onPress={() => router.back()} className="mr-3 rounded-full bg-gray-200 dark:bg-zinc-800 p-2">
            <Ionicons name="arrow-back" size={20} color={isDark ? "#f9fafb": "#27272a"} />
          </Pressable>
          <Text className="text-lg font-bold text-gray-900 dark:text-gray-50">Ride Details</Text>
        </View>

        {/* Live Tracking Map */}
        <View className={cn("mb-4 overflow-hidden rounded-3xl border border-gray-100 dark:border-gray-600 bg-gray-50 shadow-sm", { "pointer-events-none": sheetIndex !== -1 })} style={{ height: 220 }}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            customMapStyle={colorScheme === 'dark' ? mapStyle.dark : mapStyle.light}
            initialRegion={{
              latitude: ride.pickup.latitude,
              longitude: ride.pickup.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            {/* Main Ride Route (Pickup -> Destination) */}
            {mainRoute && (
              <Polyline
                coordinates={mainRoute}
                strokeWidth={3}
                strokeColor="#6366f1"
              />
            )}

            {/* Approach Route (Driver -> Pickup) - Only shown before ride starts */}
            {approachRoute && (
              <Polyline
                coordinates={approachRoute}
                strokeWidth={2}
                strokeColor="#3b82f6"
                lineDashPattern={[5, 10]}
              />
            )}
            {/* Driver Marker */}
            {driverLocation && (
              <Marker 
                coordinate={driverLocation} 
                anchor={{ x: 0.5, y: 0.5 }}
                flat
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-900 border-2 border-blue-500 shadow-lg">
                  <MaterialCommunityIcons name="car-side" size={24} color="#3b82f6" />
                </View>
              </Marker>
            )}

            {/* Pickup Marker */}
            <Marker coordinate={{ latitude: ride.pickup.latitude, longitude: ride.pickup.longitude }}>
              <View className="h-4 w-4 rounded-full border-2 border-white bg-teal-500 shadow-sm" />
            </Marker>

            {/* Destination Marker */}
            <Marker coordinate={{ latitude: ride.destination.latitude, longitude: ride.destination.longitude }}>
              <View className="h-4 w-4 rounded-full border-2 border-white bg-violet-600 shadow-sm" />
            </Marker>
          </MapView>
          
          <Pressable 
            onPress={() => setIsMapMaximized(true)}
            className="absolute top-3 right-3 h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md active:bg-white"
          >
            <MaterialCommunityIcons name="map" size={20} color="#3b82f6" />
          </Pressable>

          <Pressable 
            onPress={() => {
              if (driverLocation) {
                mapRef.current?.animateToRegion({
                  ...driverLocation,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                });
              }
            }}
            className="absolute bottom-3 right-3 h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md active:bg-white"
          >
            <MaterialIcons name="my-location" size={20} color="#3b82f6" />
          </Pressable>
        </View>

        {/* Driver card */}
        <View className={cn("mb-4 rounded-2xl border bg-white dark:bg-zinc-800 p-4 shadow-sm dark:border-zinc-600", {
          "pointer-events-none": sheetIndex !== -1,
          "border-red-200": ride.requestStatus === "Rejected",
          "border-gray-100": ride.requestStatus !== "Rejected",
        })}>

          {/* Rejection banner */}
          {ride.requestStatus === "Rejected" && (
            <View className="mb-3 flex-row items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 border border-red-100">
              <MaterialIcons name="cancel" size={16} color="#dc2626" style={{ marginTop: 1 }} />
              <View className="flex-1">
                <Text className="text-[13px] font-semibold text-red-700">
                  Driver declined your request
                </Text>
                <Text className="text-[12px] text-red-500 mt-0.5">
                  Tap the edit icon to choose a new driver.
                </Text>
              </View>
            </View>
          )}

          <Text className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Your Driver
          </Text>

          <View className='flex-row justify-between gap-2'>
            <View className="flex-1 flex-row items-center gap-3">
              {/* Avatar with red ring on rejection */}
              <View className={cn("rounded-full", {
                "p-0.5 border-2 border-red-500": ride.requestStatus === "Rejected",
              })}>
                <Avatar alt="Profile pic" className="h-14 w-14">
                  <AvatarImage
                    source={
                      ride.driver.userDetails.profilePictureKey?.trim()
                        ? { uri: ride.driver.userDetails.profilePictureKey }
                        : require('@/assets/images/avatar.jpg')
                    }
                  />
                  <AvatarFallback className="bg-indigo-100">
                    <Text className="text-base font-bold text-indigo-700">
                      {ride.driver.userDetails.firstName?.[0]}
                      {ride.driver.userDetails.lastName?.[0]}
                    </Text>
                  </AvatarFallback>
                </Avatar>
              </View>

              <View className="flex-1 items-start">
                <Text className={cn("text-base font-bold", {
                  "text-gray-400": ride.requestStatus === "Rejected",
                  "text-gray-900 dark:text-gray-100": ride.requestStatus !== "Rejected",
                })}>
                  {`${ride.driver.userDetails.firstName ?? ''} ${ride.driver.userDetails.lastName ?? ''}`.trim() || 'Driver'}
                </Text>
                <View className='flex-row gap-2'>
                  <View className="flex-row items-center gap-0.5 rounded-full bg-gray-100 dark:bg-black px-2 py-[2px]">
                    <MaterialIcons
                      name={
                        ride.driver.userDetails.gender === 'Male'
                          ? 'male'
                          : ride.driver.userDetails.gender === 'Female'
                            ? 'female'
                            : 'transgender'
                      }
                      size={12}
                      color = {isDark ? "#4b5563" : "#374151"}
                    />
                    <Text className="text-[11px] font-medium text-gray-600 dark:text-gray-50">
                      {ride.driver.userDetails.gender}
                    </Text>
                  </View>
                  {ride.driver.totalRating > 0 && (
                    <View className="mt-1 flex-row items-center gap-1">
                      <Ionicons name="star" size={13} color="#f59e0b" />
                      <Text className="text-sm text-gray-500">
                        {`${ride.driver?.averageRating ?? '--'}`}
                        <Text className="text-gray-400">{` (${ride.driver?.totalRating} trips)`}</Text>
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Edit button — highlighted on rejection */}
            <TouchableOpacity
              onPress={handleShowNearbyDrivers}
              className={cn(
                'h-10 w-10 items-center justify-center rounded-full',
                ride.requestStatus === "Rejected"
                  ? 'bg-red-500'
                  : 'bg-gray-200/50'
              )}
            >
              <MaterialIcons
                name='edit'
                size={18}
                color={ride.requestStatus === "Rejected" ? "#fff" : iconColor}
              />
            </TouchableOpacity>
          </View>

          {/* Vehicle details */}
          {vehicle && (
            <View className={cn("mt-4 flex-row items-center gap-3 rounded-xl p-3", {
              "bg-gray-50 dark:bg-zinc-950": ride.requestStatus !== "Rejected",
              "bg-red-50/60 opacity-60": ride.requestStatus === "Rejected",
            })}>
              <View className="h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                <MaterialCommunityIcons
                  name={getVehicleIcon(vehicle.type)}
                  size={22}
                  color="#4f46e5"
                />
              </View>

              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-bold text-gray-900 dark:text-gray-100">{vehicle.model}</Text>
                  {fuelStyle && (
                    <InfoPill
                      label={vehicle.fuelType}
                      color={`${fuelStyle.bg} ${fuelStyle.text}`}
                    />
                  )}
                </View>
                <View className="mt-1 flex-row items-center gap-2">
                  <Text className="text-xs text-gray-500 dark:text-gray-100">{vehicle.color}</Text>
                  <Text className="text-gray-300 dark:text-gray-50">·</Text>
                  <Text className="text-xs font-semibold tracking-widest text-gray-700 dark:text-gray-100">
                    {vehicle.registrationNumber}
                  </Text>
                </View>
              </View>

              <View className="items-center gap-0.5">
                <Ionicons name="people-outline" size={14} color={isDark ? "#f9fafb": "#27272a"}/>
                <Text className="text-xs font-semibold text-gray-600 dark:text-gray-100">
                  {vehicle.seatingCapacity}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Route */}
        <View className="mb-4 rounded-2xl border border-gray-100 dark:border-gray-600 bg-white dark:bg-zinc-800 p-4 shadow-sm">
          <Text className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Route
          </Text>

          <View className="flex-row gap-3">
            <View className="items-center pt-[5px]">
              <View className="h-2.5 w-2.5 rounded-full bg-teal-500" />
              <View className="my-1 w-px flex-1 bg-gray-200" />
              <View className="h-2.5 w-2.5 rounded-full bg-violet-500" />
            </View>

            <View className="flex-1 gap-3">
              <View>
                <Text className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-teal-500">
                  Pickup
                </Text>
                <Text className="text-sm font-semibold leading-5 text-gray-900 dark:text-gray-100">
                  {ride.pickup?.address ?? 'Not set'}
                </Text>
              </View>
              <View>
                <Text className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-violet-500">
                  Destination
                </Text>
                <Text className="text-sm font-semibold leading-5 text-gray-900 dark:text-gray-100">
                  {ride.destination?.address ?? 'Not set'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View className="mb-4 flex-row gap-2">
          <StatCard icon="cash-outline" label="Fare" value={`₹${ride.fare}`} highlight />
          <StatCard icon="map-outline" label="Distance" value={`${ride.distance} km`} />
          <StatCard
            icon="time-outline"
            label="ETA"
            value={routeState?.remainingDuration ?? ride.expectedDuration ?? '—'}
          />
        </View>

        {/* OTP */}
        {ride.status === 'Open' && (
          <View className="mb-4 items-center rounded-2xl bg-indigo-50 dark:bg-zinc-800 px-6 py-7">
            <Text className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
              Share with your driver
            </Text>
            <Text className="mt-4 h-14 text-5xl font-extrabold tracking-[12px] text-indigo-900 dark:text-indigo-300">
              {ride.otp}
            </Text>
            <View className="mt-4 flex-row items-center gap-1.5">
              <Ionicons name="lock-closed-outline" size={12} color="#a5b4fc" />
              <Text className="text-xs text-indigo-300">Do not share with anyone else</Text>
            </View>

            {/* Confirm prompt */}
            <View className="-mx-2 mt-2 rounded-xl bg-emerald-50 dark:bg-indigo-100 px-4 py-2">
              <Text className="text-center text-sm font-semibold text-emerald-700 dark:text-indigo-600">
                Confirm once you are inside the vehicle
              </Text>
            </View>
          </View>
        )}

        {(ride.status === 'Open' || ride.status === 'Active') && (
          <View
            className={`mb-4 flex-row items-center gap-3 rounded-2xl border px-4 py-3 ${
              ride.status === 'Open'
                ? 'border-amber-500/30 bg-amber-500/10'
                : 'border-emerald-500/30 bg-emerald-500/10'
            }`}>
            <PulseDot color={ride.status === 'Open' ? 'bg-orange-400' : 'bg-green-400'} />
            <View className="flex-1">
              <Text
                className={`text-sm font-extrabold ${
                  ride.status === 'Open' 
                    ? ride.requestStatus === "Pending" 
                      ? 'text-amber-400' 
                      : ride.requestStatus === "Rejected" 
                        ? 'text-red-500' 
                        : 'text-emerald-400'
                    : 'text-emerald-400'
                }`}>
                {ride.status === 'Open' 
                  ? ride.requestStatus === "Pending" 
                    ? "Pending" 
                    : ride.requestStatus === "Rejected" 
                      ? "Driver Un-available"
                      : 'Driver Assigned'
                  : 'Ride in Progress'
                }
              </Text>
              
              <Text className="mt-0.5 text-[11px] font-medium text-slate-500">
                {ride.status === 'Open' 
                  ? ride.requestStatus === "Pending" 
                    ? "Waiting for driver to accept request" 
                    : ride.requestStatus === "Rejected"
                      ? "Please try requesting again"
                      : 'Driver is on the way'
                  : 'On your way to destination'
                }
              </Text>
            </View>
            <LiveTimer
              startTimestamp={
                ride.status === 'Open' ? ride.updatedAt : (ride.startedAt ?? ride.updatedAt)
              }
            />
          </View>
        )}

        {/* Cancel button */}
        {ride.status === 'Open' && (
          <TouchableOpacity
            onPress={handleCancel}
            disabled={cancelling || ride.status !== 'Open'}
            className={cn("my-3 flex-row items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 active:opacity-70", { "pointer-events-none": sheetIndex !== -1 })}>
            {cancelling ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <Ionicons name="close-circle-outline" size={18} color="#dc2626" />
            )}
            <Text className="text-sm font-semibold text-red-600">
              {cancelling ? 'Cancelling…' : 'Cancel Ride Request'}
            </Text>
          </TouchableOpacity>
        )}

        {/* feedback button */}
        {ride.status === "Completed" && (
          <Button
            onPress={() => router.push(`/feedback/${id}`)}
          >
            <Text className=''>
              Give Feedback
            </Text>
          </Button>
        )}
      </ScrollView>

      <BottomSheet
        ref={bottomSheetRef}
        index={sheetIndex}
        animatedIndex={animatedIndex}
        onChange={setSheetIndex}
        snapPoints={["45%", "80%"]}
        enableDynamicSizing={false}
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: BottomSheetBackgroundColor, borderRadius: 32 }}
        handleIndicatorStyle={{ backgroundColor: BottomSheetIndicatorColor, width: 48, height: 4 }}
        animationConfigs={{ damping: 80, overshootClamping: true, stiffness: 500 }}
      >
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          <View style={{ flex: 1 }} pointerEvents="box-none">
            <SheetLayer animatedIndex={animatedIndex} visibleFrom={0.5}>
              <View style={{ paddingVertical: 0 }}>
                {/* Header with back option to re-plan */}
                <View className="flex-row items-center px-4 py-2">
                  <TouchableOpacity onPress={() => bottomSheetRef.current?.close()} className="p-2">
                    <Ionicons name="arrow-back" size={24} color={isDark ? 'white' : 'black'} />
                  </TouchableOpacity>
                  <Text className="mr-8 flex-1 text-center text-lg font-bold text-foreground">
                    Choose a driver
                  </Text>
                </View>

                <NearbyDrivers
                  drivers={nearbyDrivers ?? []}
                  selectedDriver={selectedDriver?.driver._id ?? null}
                  onSelect={(driver) => {
                    setSheetIndex(0);
                    setSelectedDriver(driver);
                  }}
                  isDark={isDark}
                  filters={filters}
                  setFilters={setFilters}
                  genderMatch={genderMatch}
                  setGenderMatch={setGenderMatch}
                  riderGender={ride.rider.userDetails.gender} // REMINDER GET IT CHECKED OUT, TO SEE IF IM GETTING THE USER THE RIGHT WAY
                />
              </View>
            </SheetLayer>

            {selectedDriver && (
              <SheetLayer animatedIndex={animatedIndex} visibleFrom={0} visibleUntil={0.5}>
                <View style={{ paddingHorizontal: 24, paddingVertical: 10 }}>
                  <View className="mb-1 items-center">
                    <Text className="text-xl font-extrabold text-foreground">Driver details</Text>
                  </View>

                  <View className="mb-3 gap-2 rounded-2xl bg-background p-4">
                    <View className="flex-row items-center gap-3">
                      {/* Avatar */}
                      <Avatar alt="Profile pic" className="h-9 w-9">
                        <AvatarImage
                          source={
                            selectedDriver.driver.userDetails.profilePictureKey?.trim()
                              ? { uri: selectedDriver.driver.userDetails.profilePictureKey }
                              : require('@/assets/images/avatar.jpg')
                          }
                        />
                        <AvatarFallback className="bg-white/20">
                          <Text className="text-xs font-bold text-primary">
                            {selectedDriver.driver.userDetails.firstName?.[0]}
                            {selectedDriver.driver.userDetails?.lastName?.[0]}
                          </Text>
                        </AvatarFallback>
                      </Avatar>

                      <View>
                        <Text className="text-base font-semibold text-foreground">
                          {selectedDriver.driver.userDetails.firstName} {selectedDriver.driver.userDetails.lastName}
                        </Text>
                        <View className="mt-0.5 flex-row items-center gap-1">
                          {selectedDriver.driver.averageRating && (
                            <>
                              <Ionicons name="star" size={14} color="orange" />
                              <Text className="text-sm text-muted-foreground">
                                {selectedDriver.driver.averageRating}
                              </Text>
                            </>
                          )}
                          {/* Gender badge */}
                          <View className="flex-row items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1">
                            <MaterialIcons
                              name={
                                selectedDriver.driver.userDetails.gender === 'Male'
                                  ? 'male'
                                  : selectedDriver.driver.userDetails.gender === 'Female'
                                    ? 'female'
                                    : 'transgender'
                              }
                              size={13}
                              color="rgba(255,255,255,0.8)"
                            />
                            <Text className="text-xs font-medium text-white">
                              {selectedDriver.driver.userDetails.gender}
                            </Text>
                          </View>
                          {/* Verified badge */}
                          <View
                            style={{ backgroundColor: licenseVerification.color + '30' }}
                            className="flex-row items-center gap-1 self-start rounded-full px-2.5 py-1">
                            <Feather
                              name={licenseVerification.icon as any}
                              size={11}
                              color={licenseVerification.color}
                            />
                            <Text
                              style={{ color: licenseVerification.color }}
                              className="text-xs font-semibold">
                              {licenseVerification.label}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <Separator />
                    <View className='flex-row items-center gap-3'>
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                        <MaterialCommunityIcons
                          name={getVehicleIcon(selectedDriver.vehicle.type)}
                          size={22}
                          color="#4f46e5"
                        />
                      </View>
                      <Text className="text-sm font-semibold text-foreground">
                        {selectedDriver.vehicle.registrationNumber} -{' '}
                        {selectedDriver.vehicle.class}
                      </Text>
                    </View>

                    <View className="h-[1px] bg-border" />

                    <View className="flex-row items-center justify-between rounded-xl bg-muted/30 px-3">
                      <View>
                        <Text className="text-sm text-muted-foreground">
                          {distanceFormat(Number(ride.distance))}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-lg font-bold text-foreground">
                          ₹{selectedDriver.fare}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Confirm button */}
                  <Button onPress={handleChangeDriver} className="h-14 rounded-xl">
                    <Text className="text-lg font-bold text-secondary">Confirm Driver</Text>
                  </Button>
                </View>
              </SheetLayer>
            )}

            {!selectedDriver && (
              <SheetLayer animatedIndex={animatedIndex} visibleFrom={0} visibleUntil={0.5}>
                <View style={{ paddingHorizontal: 24, paddingVertical: 10 }}>
                  <View className="mb-2 items-center">
                    <Text className="text-xl font-extrabold text-foreground">Your route</Text>
                  </View>

                  <View className="mb-4 gap-3">
                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={{ minWidth: 130 }}
                      className={cn(
                        'flex-row items-center gap-2 rounded-2xl border-2 border-transparent bg-muted/20 px-3 py-2'
                      )}>
                      <View className={cn('h-9 w-9 items-center justify-center rounded-full')}>
                        <MaterialCommunityIcons name="map-marker" size={24} color="green" />
                      </View>

                      <View className="flex-1">
                        <Text numberOfLines={1} className="text-sm font-semibold text-foreground">
                          {ride.pickup.address}
                        </Text>
                        <Text className="text-xs text-muted-foreground">Pickup</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={{ minWidth: 130 }}
                      className={cn(
                        'flex-row items-center gap-2 rounded-2xl border-2 border-transparent bg-muted/20 px-3 py-2'
                      )}>
                      <View className={cn('h-9 w-9 items-center justify-center rounded-full')}>
                        <MaterialCommunityIcons name="map-marker" size={24} color="red" />
                      </View>

                      <View className="flex-1">
                        <Text numberOfLines={1} className="text-sm font-semibold text-foreground">
                          {ride.destination.address}
                        </Text>
                        <Text className="text-xs text-muted-foreground">Destination</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Confirm button */}
                  <Button onPress={() => setSheetIndex(1)} className="h-14 rounded-xl">
                    <Text className="text-lg font-bold text-secondary">Choose driver</Text>
                  </Button>
                </View>
              </SheetLayer>
            )}
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
