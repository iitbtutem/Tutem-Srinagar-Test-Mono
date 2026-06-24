import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import uuid from 'react-native-uuid';
import Constants from 'expo-constants';
import {
  View,
  TouchableOpacity,
  Keyboard,
  ActivityIndicator,
  BackHandler,
  Image,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import BottomSheet, { BottomSheetFlatList, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// import * as Location from 'expo-location';
import { useColorScheme } from 'nativewind';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { mapStyle } from '@/constants/mapStyles';
import Animated, {
  useAnimatedStyle,
  interpolate,
  useSharedValue,
  Extrapolation,
  withTiming,
  SharedValue,
  useAnimatedProps,
  useDerivedValue,
} from 'react-native-reanimated';
import { useToast } from '@/components/CustomToast';
import { getAddressFromCoords, fetchRoute } from '@/lib/maps';
import { colors, VERIFICATION_CONFIG } from '@/constants/colors';
import { useRouter } from 'expo-router';
import { cn, distanceFormat, formatFare } from '@/lib/utils';
import { useAction } from 'convex/react';
import { api } from '@tutem/api';
import { FunctionReturnType } from 'convex/server';
import { VEHICLE_CLASS } from '../../../../../packages/api/convex/CONSTANTS';
import { useRider } from '@/hooks/useRider';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Text,
  Button,
  Switch,
  GenderAge,
  Rating,
  Separator,
} from '@tutem/ui';
import useThemeColors from '@/hooks/useColorScheme';
import { useLocation } from '@/hooks/useCurrentLocation';

// Vehicle Icons
const VEHICLE_ICONS = {
  Cab: 'car',
  Bike: 'bike',
  Auto: 'rickshaw',
} as const;

type Cords = { latitude: number; longitude: number };

type VehicleClass = (typeof VEHICLE_CLASS)[number];

// SheetLayer
type SheetLayerProps = {
  children: React.ReactNode;
  animatedIndex: SharedValue<number>;
  visibleFrom?: number;
  visibleUntil?: number;
};
const AnimatedView = Animated.createAnimatedComponent(View);
function SheetLayer({ children, animatedIndex, visibleFrom = 0, visibleUntil }: SheetLayerProps) {
  const opacity = useDerivedValue(() => {
    const inputRange =
      visibleUntil !== undefined
        ? [visibleFrom - 0.3, visibleFrom, visibleUntil, visibleUntil + 0.3]
        : [visibleFrom - 0.3, visibleFrom];
    const outputRange = visibleUntil !== undefined ? [0, 1, 1, 0] : [0, 1];
    return interpolate(animatedIndex.value, inputRange, outputRange, Extrapolation.CLAMP);
  });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const animatedProps = useAnimatedProps(() => ({
    pointerEvents: opacity.value > 0.1 ? ('box-none' as const) : ('none' as const),
  }));

  return (
    <AnimatedView
      animatedProps={animatedProps}
      style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, animatedStyle]}>
      {children}
    </AnimatedView>
  );
}

// NearbyDriversPanel
type NearbyDriver = NonNullable<
  FunctionReturnType<typeof api.actions.actions.getNearbyDrivers>[number]
>;

type NearbyDriversPanelProps = {
  drivers: NearbyDriver[];
  selectedDriver: string | null;
  onSelect: (id: string) => void;
  sheetState: 'FULL' | 'COLLAPSED';
  filters: ('Bike' | 'Auto' | 'Cab')[];
  setFilters: React.Dispatch<React.SetStateAction<('Bike' | 'Auto' | 'Cab')[]>>;
  riderGender: 'Male' | 'Female' | 'Other';
  genderMatch: boolean;
  setGenderMatch: React.Dispatch<React.SetStateAction<boolean>>;
  hasSearchedDrivers: boolean;
  onFindDriver: () => void;
  isSearchingDrivers: boolean;
};

function NearbyDriversPanel({
  drivers,
  selectedDriver,
  onSelect,
  filters,
  setFilters,
  genderMatch,
  setGenderMatch,
  hasSearchedDrivers,
  onFindDriver,
  isSearchingDrivers,
}: NearbyDriversPanelProps) {
  type VehicleClass = (typeof VEHICLE_CLASS)[number];
  console.log('DRIVERS', drivers);

  return (
    <View className="mb-6 px-4 pt-2">
      {/* Filters */}
      <View className="mb-3 flex-row items-center">
        <BottomSheetFlatList
          data={VEHICLE_CLASS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item: VehicleClass) => item}
          contentContainerStyle={{ gap: 4 }}
          renderItem={({ item }: { item: VehicleClass }) => {
            const isSelected = filters.includes(item);
            return (
              <TouchableOpacity
                onPress={() => {
                  setFilters((prev) =>
                    prev.includes(item) ? prev.filter((el) => el !== item) : [...prev, item]
                  );
                }}
                className={cn(
                  'flex-row items-center gap-x-1 rounded-full border px-3 py-1',
                  isSelected ? 'border-primary bg-primary' : 'border-border bg-background'
                )}>
                <MaterialCommunityIcons
                  name={VEHICLE_ICONS[item]}
                  size={13}
                  color={isSelected ? 'white' : 'black'}
                />
                <Text
                  className={cn(
                    'text-sm',
                    isSelected ? 'text-primary-foreground' : 'text-foreground'
                  )}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
        <View className="flex-row items-center gap-2">
          <Text className="text-xs"> Gender{'\n'}Matching</Text>
          <Switch checked={genderMatch} onCheckedChange={setGenderMatch} />
        </View>
      </View>

      {!hasSearchedDrivers ? (
        <Button
          onPress={onFindDriver}
          className="mt-auto h-14 rounded-xl"
          disabled={isSearchingDrivers}>
          {isSearchingDrivers ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-lg font-bold text-secondary">Find My Driver</Text>
          )}
        </Button>
      ) : (
        <>
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Nearby drivers</Text>
            {isSearchingDrivers ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text className="text-xs text-muted-foreground">{drivers.length} available</Text>
            )}
          </View>

          {/* Driver list */}
          {drivers.length > 0 ? (
            <BottomSheetScrollView
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 3 }}>
              {drivers.map((driver) => {
                const isSelected = selectedDriver === driver.driver._id;
                const verificationStatus = driver?.driver?.isLicenseVerified;

                const licenseVerification = verificationStatus
                  ? VERIFICATION_CONFIG[verificationStatus]
                  : VERIFICATION_CONFIG['Pending'];

                return (
                  <TouchableOpacity
                    key={driver.driver._id}
                    onPress={() => onSelect(driver.driver._id)}
                    activeOpacity={0.85}
                    className={cn(
                      'flex-1 flex-row items-center justify-between gap-3 rounded-2xl border border-primary/50 px-1 py-2.5',
                      isSelected ? 'bg-primary/15' : 'bg-primary/0'
                    )}>
                    {/* Avatar and gender */}
                    <View className="items-center justify-center gap-1.5">
                      <Avatar alt="Profile pic" className="h-14 w-14">
                        <AvatarImage
                          source={
                            driver.driver.userDetails.profilePictureKey?.trim()
                              ? { uri: driver.driver.userDetails?.profilePictureKey }
                              : require('@/assets/images/avatar.jpg')
                          }
                        />
                        <AvatarFallback className="bg-white/20">
                          <Text className="text-xs font-bold text-primary">
                            {driver.driver.userDetails?.firstName?.[0]}
                            {driver.driver.userDetails?.lastName?.[0]}
                          </Text>
                        </AvatarFallback>
                      </Avatar>
                      <GenderAge
                        gender={driver.driver.userDetails?.gender}
                        dob={driver.driver.userDetails?.dob}
                      />
                    </View>

                    {/* Middle Content */}
                    <View className="min-w-0 flex-1">
                      {/* Name + Verified */}
                      <Text className="font-semibold text-primary">
                        {driver.driver.userDetails.firstName} {driver.driver.userDetails.lastName}
                      </Text>

                      <Text className="text-xs font-medium">{driver.driver.organization.name}</Text>

                      <View className="flex-row items-center justify-start">
                        <MaterialCommunityIcons
                          name={VEHICLE_ICONS[driver.vehicle.class]}
                          size={16}
                          color={colors.primary}
                        />
                        <Text className="text-sm capitalize text-slate-600">
                          {` | ${driver.vehicle.color} | ${driver.vehicle.model} `}
                        </Text>
                      </View>

                      {/* vehicle and driver rating and verification */}
                      <View className="mt-0.5 flex-row items-center gap-2">
                        <Rating rating={driver.driver.rating} />

                        {/* Verified Badge (inline, not floating) */}
                        {driver.driver.isLicenseVerified === 'Verified' && (
                          <View className="flex-row items-center gap-1">
                            <Feather
                              name={licenseVerification.icon as any}
                              size={12}
                              color={licenseVerification.color}
                            />
                            <Text
                              style={{ color: licenseVerification.color }}
                              className="text-[10px] font-semibold">
                              {licenseVerification.label}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Fare */}
                    <Text className="px-1 text-base font-bold text-foreground">₹{driver.fare}</Text>
                  </TouchableOpacity>
                );
              })}
            </BottomSheetScrollView>
          ) : (
            <Text>{isSearchingDrivers ? 'Searching for drivers...' : 'No nearby drivers.'}</Text>
          )}
        </>
      )}
    </View>
  );
}

export default function WhereTo() {
  const { rider } = useRider();
  const bookRide = useAction(api.actions.ride.bookRide);

  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { location: currentLocation, refreshLocation } = useLocation();
  const { BottomSheetBackgroundColor, BottomSheetIndicatorColor } = useThemeColors();

  const bottomSheetRef = useRef<BottomSheet>(null);
  const confirmSheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView>(null);
  const pickupRef = useRef<any>(null);
  const destinationRef = useRef<any>(null);

  const snapPoints = useMemo(() => ['45%', '85%'], []);
  const [sheetIndex, setSheetIndex] = useState(1);
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const sheetState = sheetIndex >= 1 ? 'FULL' : 'COLLAPSED';

  const [filters, setFilters] = useState<VehicleClass[]>([]);

  const [genderMatch, setGenderMatch] = useState(false);

  const [pickupLocation, setPickupLocation] = useState<{
    title: string;
    coords: { latitude: number; longitude: number };
  } | null>(null);

  const [destination, setDestination] = useState<{
    title: string;
    coords: { latitude: number; longitude: number };
  } | null>(null);

  const [isPickupSetAutomatically, setIsPickupSetAutomatically] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<{
    distance: { text: string; value: number };
    duration: string;
    polyline: { latitude: number; longitude: number }[];
  } | null>(null);

  const bothSelected = !!(pickupLocation && destination);

  const [mapSelectionMode, setMapSelectionMode] = useState<'pickup' | 'destination' | null>(
    'destination'
  );
  const [isSetLocationExpanded, setIsSetLocationExpanded] = useState(false);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [isUpdatingFromMap, setIsUpdatingFromMap] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const [isSearchingDrivers, setIsSearchingDrivers] = useState(false);

  const getNearbyDriversAction = useAction(api.actions.actions.getNearbyDrivers);

  // Track if we're in driver selection mode
  const [showDrivers, setShowDrivers] = useState(false);
  const [hasSearchedDrivers, setHasSearchedDrivers] = useState(false);

  const apiKey =
    Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const pickupSessionToken = useRef<string>(uuid.v4() as string).current;
  const destinationSessionToken = useRef<string>(uuid.v4() as string).current;

  const [isPickupSearching, setIsPickupSearching] = useState(false);
  const [isDestinationSearching, setIsDestinationSearching] = useState(false);
  const [tempLocation, setTempLocation] = useState<{
    title: string;
    latitude: number;
    longitude: number;
  } | null>(null);

  const animatedIndex = useSharedValue(1);

  // Discovery logic using Action
  useEffect(() => {
    if (
      bothSelected &&
      showDrivers &&
      hasSearchedDrivers &&
      selectedRoute &&
      rider &&
      rider.riderDetails &&
      pickupLocation
    ) {
      const riderId = rider.riderDetails._id;
      const pickupLat = pickupLocation.coords.latitude;
      const pickupLon = pickupLocation.coords.longitude;

      const fetchDrivers = async () => {
        setIsSearchingDrivers(true);
        try {
          const drivers = await getNearbyDriversAction({
            pickup: {
              latitude: pickupLat,
              longitude: pickupLon,
            },
            destination: {
              latitude: destination!.coords.latitude,
              longitude: destination!.coords.longitude,
            },
            distance: selectedRoute?.distance.value ?? 0,
            riderId: riderId,
            genderMatch: genderMatch,
            filters: filters,
          });
          setNearbyDrivers(drivers);
        } catch (error) {
          console.error('Discovery error:', error);
          setNearbyDrivers([]);
        } finally {
          setIsSearchingDrivers(false);
        }
      };

      fetchDrivers();
      // Optionally poll every 30s
      const pollId = setInterval(fetchDrivers, 30000);
      return () => clearInterval(pollId);
    } else {
      setNearbyDrivers([]);
    }
  }, [
    bothSelected,
    showDrivers,
    hasSearchedDrivers,
    selectedRoute?.distance.value,
    rider?.riderDetails?._id,
    genderMatch,
    filters,
  ]);

  const fitMap = useCallback(
    (cords: Cords = currentLocation, duration: number = 1000) => {
      const newRegion = {
        ...cords,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      };
      mapRef.current?.animateToRegion(newRegion, duration);
    },
    [currentLocation]
  );

  async function getCurrentLocation() {
    setIsPickupSearching(true);

    const title = await getAddressFromCoords(currentLocation.latitude, currentLocation.longitude);
    pickupRef.current?.setAddressText(title);
    setPickupLocation({
      title,
      coords: { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
    });

    setIsPickupSearching(false);
  }

  useEffect(() => {
    fitMap();
    getCurrentLocation();
  }, [currentLocation]);

  useEffect(() => {
    if (rider && rider.riderDetails) setGenderMatch(rider.riderDetails.genderMatching);
  }, [rider]);

  const handlePickupSelect = async (data: any, details: any = null) => {
    if (details?.geometry?.location) {
      const coords = {
        latitude: details.geometry.location.lat,
        longitude: details.geometry.location.lng,
      };
      setPickupLocation({
        title: data.description || data.structured_formatting?.main_text || 'Selected Location',
        coords,
      });
      fitMap(coords);

      setMapSelectionMode(null);

      if (destination) {
        setShowDrivers(true);
        setHasSearchedDrivers(false);
        setSheetIndex(0);
        Keyboard.dismiss();
      }
    }
  };

  const handleDestinationSelect = async (data: any, details: any = null) => {
    if (details?.geometry?.location) {
      const dropoffCoords = {
        latitude: details.geometry.location.lat,
        longitude: details.geometry.location.lng,
      };
      setDestination({
        title: data.description || data.structured_formatting?.main_text || 'Selected Destination',
        coords: dropoffCoords,
      });

      fitMap(dropoffCoords);

      // If pickup location is null, set it to current location
      if (!pickupLocation && !isPickupSetAutomatically) {
        setIsPickupSetAutomatically(true);
        await getCurrentLocation();
      }

      // Auto-show drivers panel when destination is selected
      setShowDrivers(true);
      setHasSearchedDrivers(false);
      setSheetIndex(0);
      Keyboard.dismiss();
      setMapSelectionMode(null);
    }
  };

  const handleBackToPlanning = () => {
    pickupRef.current?.setAddressText(pickupLocation?.title || '');
    setDestination(null);
    setShowDrivers(false);
    setHasSearchedDrivers(false);
    setSelectedDriverId(null);
    setSheetIndex(1);
  };

  const confirmLocationFromMap = () => {
    if (!tempLocation && pickupLocation && destination) {
      setSheetIndex(0);
      return;
    }
    if (!tempLocation) return;

    const { title, latitude, longitude } = tempLocation;
    let isBoth = false;

    if (mapSelectionMode === 'pickup') {
      setPickupLocation({ title, coords: { latitude, longitude } });
      pickupRef.current?.setAddressText(title);

      if (destination) {
        setShowDrivers(true);
        setHasSearchedDrivers(false);
        isBoth = true;
      }
    } else if (mapSelectionMode === 'destination') {
      setDestination({ title, coords: { latitude, longitude } });
      destinationRef.current?.setAddressText(title);

      if (pickupLocation) {
        setShowDrivers(true);
        setHasSearchedDrivers(false);
        isBoth = true;
      } else {
        // Also show drivers if destination is set, wait no, only if both.
        // But the existing code did setShowDrivers(true) here unconditionally.
        setShowDrivers(true);
        setHasSearchedDrivers(false);
      }
    }

    setTempLocation(null);
    setSheetIndex(isBoth || (mapSelectionMode === 'destination' && pickupLocation) ? 0 : 1);
    setMapSelectionMode(null);
    setTimeout(() => {
      if (mapSelectionMode === 'pickup') pickupRef.current?.blur();
      else if (mapSelectionMode === 'destination') destinationRef.current?.blur();
    }, 300);
  };

  const onRegionChangeComplete = async (region: any) => {
    if (
      sheetState === 'COLLAPSED' &&
      !isPickupSearching &&
      !isDestinationSearching &&
      !isUpdatingFromMap &&
      mapSelectionMode !== null
    ) {
      setIsUpdatingFromMap(true);
      try {
        const title = await getAddressFromCoords(region.latitude, region.longitude);
        setTempLocation({ title, latitude: region.latitude, longitude: region.longitude });

        const route =
          mapSelectionMode === 'pickup'
            ? await fetchRoute(
                { latitude: region.latitude, longitude: region.longitude },
                destination
                  ? destination.coords
                  : { latitude: region.latitude, longitude: region.longitude }
              )
            : await fetchRoute(
                pickupLocation
                  ? pickupLocation.coords
                  : { latitude: region.latitude, longitude: region.longitude },
                { latitude: region.latitude, longitude: region.longitude }
              );
        if (!route) return;
        setSelectedRoute(route);
        setRouteCoords(route.polyline);
      } catch (error) {
        console.error('Failed to update location from map', error);
      } finally {
        setIsUpdatingFromMap(false);
      }
    }
  };

  const handleLocatePress = async () => {
    await refreshLocation();
    fitMap();
  };

  const fitCurrentMapToCenter = async () => {
    if (mapRef.current) {
      const camera = await mapRef.current.getCamera();
      const cords = { latitude: camera.center.latitude, longitude: camera.center.longitude };
      fitMap(cords, 500);
    }
    return null;
  };

  useEffect(() => {
    if (!!pickupLocation) pickupRef.current?.setAddressText(pickupLocation.title);
    destinationRef.current?.focus();
  }, [bothSelected, showDrivers]);

  // Update route when locations change
  useEffect(() => {
    if (bothSelected) {
      (async () => {
        const route = await fetchRoute(pickupLocation.coords, destination.coords);
        if (!route) return;
        setSelectedRoute(route);
        setRouteCoords(route.polyline);
        if (route.polyline.length > 0) {
          mapRef.current?.fitToCoordinates([pickupLocation.coords, destination.coords], {
            edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
            animated: true,
          });
        }
      })();
    } else {
      setSelectedRoute(null);
      setRouteCoords([]);
    }
  }, [bothSelected]);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (confirmSheetOpen) {
        confirmSheetRef.current?.close();
        setConfirmSheetOpen(false);
        setSelectedDriverId(null);
        setTimeout(() => {
          bottomSheetRef.current?.snapToIndex(1);
          setSheetIndex(1);
        }, 200);
        return true;
      }
      if (showDrivers) {
        // Go back to planning mode instead of exiting
        handleBackToPlanning();
        return true; // Prevent default back behavior
      }
      return false; // Allow default back behavior
    });

    return () => backHandler.remove();
  }, [showDrivers, confirmSheetOpen, handleBackToPlanning]);

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(isSetLocationExpanded ? '180deg' : '0deg') }],
  }));

  const handleSheetChanges = useCallback((index: number) => {
    setSheetIndex(index);
    if (index === 0) Keyboard.dismiss();
  }, []);

  const selectedDriver = nearbyDrivers?.find(
    (nearbyDriver) => nearbyDriver.driver._id === selectedDriverId
  );

  const handleDriverSelect = useCallback((driverId: string) => {
    setSelectedDriverId(driverId);
    // Collapse the main sheet then open the confirm sheet
    bottomSheetRef.current?.collapse();
    setConfirmSheetOpen(true);
    setTimeout(() => confirmSheetRef.current?.snapToIndex(0), 100);
  }, []);

  const handleCloseConfirm = useCallback(() => {
    confirmSheetRef.current?.close();
    setConfirmSheetOpen(false);
    setSelectedDriverId(null);
    // Re-open the main sheet at the driver-list snap point
    setTimeout(() => {
      bottomSheetRef.current?.snapToIndex(1);
      setSheetIndex(1);
    }, 100);
  }, []);

  const handleConfirmRide = async () => {
    if (rider?._id === undefined || rider.riderDetails === null) return;

    try {
      if (selectedDriver === undefined) throw new Error('Please select a driver');
      if (pickupLocation === null) throw new Error('Please select pickup location');
      if (destination === null) throw new Error('Please select destination');

      const rideId = await bookRide({
        riderId: rider.riderDetails._id,
        driverId: selectedDriver.driver._id,
        pickup: {
          address: pickupLocation.title,
          ...pickupLocation.coords,
        },
        destination: {
          address: destination.title,
          ...destination.coords,
        },
        distance: selectedRoute?.distance.value ?? 0,
        expectedDuration: selectedRoute?.duration,
        fare: selectedDriver.fare,
      });
      showToast({
        title: 'Ride booked successfully',
        type: 'success',
      });
      if (router.canDismiss()) router.dismissAll();
      router.push({ pathname: '/ride/rideRequest', params: { id: rideId } });
    } catch (error: any) {
      console.log(`error ${error}`);
      showToast({
        title: 'Error',
        description: error.data ?? 'Failed to book ride',
        type: 'error',
      });
    }
  };

  const verificationStatus = selectedDriver?.driver?.isLicenseVerified;

  const licenseVerification = verificationStatus
    ? VERIFICATION_CONFIG[verificationStatus]
    : VERIFICATION_CONFIG['Pending'];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* ── Map ── */}
      <View className="relative h-2/3 bg-background">
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          showsUserLocation
          followsUserLocation
          showsMyLocationButton={false}
          mapPadding={{ top: 10, right: 10, bottom: 10, left: 10 }}
          mapType="standard"
          userLocationUpdateInterval={5000}
          style={{ height: '100%', width: 'auto' }}
          onRegionChangeComplete={onRegionChangeComplete}
          initialRegion={{
            ...currentLocation,
            latitudeDelta: 0.3,
            longitudeDelta: 0.3,
          }}>
          {nearbyDrivers?.map((nearbyDriver) => (
            <Marker
              key={nearbyDriver.driver._id}
              coordinate={{
                latitude: nearbyDriver.cords.latitude,
                longitude: nearbyDriver.cords.longitude,
              }}
              anchor={{ x: 0, y: 0 }}>
              {/* <MaterialCommunityIcons name="car-hatchback" size={30} color={iconColor} /> */}
              <Image
                source={require('@/assets/images/top_cab.png')}
                style={{ width: 30, height: 35 }}
                resizeMode="contain"
              />
            </Marker>
          ))}
          {pickupLocation?.coords && (
            <Marker coordinate={pickupLocation.coords} anchor={{ x: 0.5, y: 0.5 }}>
              <MaterialCommunityIcons name="map-marker" size={30} color={colors.pickup} />
            </Marker>
          )}
          {destination?.coords && (
            <Marker coordinate={destination.coords} anchor={{ x: 0.5, y: 1 }}>
              <MaterialCommunityIcons name="map-marker" size={30} color={colors.destination} />
            </Marker>
          )}
          {routeCoords.length > 0 && (
            <Polyline
              coordinates={routeCoords}
              strokeWidth={4}
              strokeColor="#1a1a2e"
              fillColor="#7800e0"
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>

        {sheetState === 'COLLAPSED' && (
          <TouchableOpacity
            className="absolute left-5 top-5 z-0 h-12 w-12 items-center justify-center rounded-full bg-muted shadow-lg"
            onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1a73e8" />
          </TouchableOpacity>
        )}

        {sheetState === 'COLLAPSED' && (
          <TouchableOpacity
            className="absolute bottom-28 right-5 z-0 h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg"
            style={{ elevation: 5 }}
            onPress={handleLocatePress}
            activeOpacity={0.8}>
            <MaterialCommunityIcons name="crosshairs-gps" size={24} color="#1a73e8" />
          </TouchableOpacity>
        )}

        {sheetState === 'COLLAPSED' && mapSelectionMode !== null && (
          <View className="pointer-events-none absolute inset-0 items-center justify-center">
            {isPickupSearching || isDestinationSearching ? (
              <ActivityIndicator size="large" color={'black'} className="-mt-8" />
            ) : (
              <View className="-mt-8 items-center justify-center">
                <View className="h-6 w-6 items-center justify-center rounded-full bg-foreground shadow-sm">
                  <View className="h-2 w-2 rounded-full bg-background" />
                </View>
                <View className="h-5 w-1 bg-foreground" />
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Bottom Sheet ── */}
      <BottomSheet
        ref={bottomSheetRef}
        index={sheetIndex}
        animatedIndex={animatedIndex}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        backgroundStyle={{ backgroundColor: BottomSheetBackgroundColor, borderRadius: 32 }}
        handleIndicatorStyle={{ backgroundColor: BottomSheetIndicatorColor, width: 48, height: 4 }}
        animationConfigs={{ damping: 80, overshootClamping: true, stiffness: 500 }}
        keyboardBehavior="extend"
        // enableHandlePanningGesture={!nearbyDrivers?.length || !!selectedDriver}
        // enableContentPanningGesture={!nearbyDrivers?.length || !!selectedDriver}
      >
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          {/* ── OVERLAY LAYERS ────────────────────────────────────────────────
              Three layers total. Only one is ever visible at a time:

              1. DRIVERS LAYER   — both locations set, sheet FULL
              2. PLANNING LAYER  — location not fully set, sheet FULL
              3. MAP-PIN LAYER   — sheet COLLAPSED (map drag selection)
          ──────────────────────────────────────────────────────────────────── */}
          <View style={{ flex: 1 }} pointerEvents="box-none">
            {/* LAYER 1: Both locations set — show nearby drivers */}
            {bothSelected && showDrivers && !selectedDriver && (
              <SheetLayer animatedIndex={animatedIndex} visibleFrom={0.5}>
                <View style={{ paddingVertical: 0 }}>
                  {/* Header with back option to re-plan */}
                  <View className="flex-row items-center px-4 py-2">
                    <TouchableOpacity onPress={handleBackToPlanning} className="p-2">
                      <Ionicons name="arrow-back" size={24} color={'black'} />
                    </TouchableOpacity>
                    <Text className="mr-8 flex-1 text-center text-lg font-bold text-foreground">
                      {hasSearchedDrivers ? 'Choose a driver' : 'Find My Driver'}
                    </Text>
                  </View>

                  {/* Route summary pill */}
                  <View className="mx-4 mb-3 flex-row items-center gap-2 rounded-2xl bg-muted/20 px-4 py-3">
                    {selectedRoute ? (
                      <Text className="-pl-3 -ml-3 text-xs font-semibold text-foreground">
                        {selectedRoute.distance.text}
                      </Text>
                    ) : (
                      <ActivityIndicator color={'grey'} size={'small'} />
                    )}
                    <View className="items-center gap-1">
                      <View className="h-2 w-2 rounded-full bg-green-500" />
                      <View className="h-4 w-0.5 bg-muted-foreground/40" />
                      <View className="h-2 w-2 rounded-full bg-red-500" />
                    </View>
                    <View className="flex-1 gap-1">
                      <Text numberOfLines={1} className="text-xs font-semibold text-foreground">
                        {pickupLocation?.title}
                      </Text>
                      <Text numberOfLines={1} className="text-xs text-muted-foreground">
                        {destination?.title}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleBackToPlanning}
                      className="rounded-lg bg-muted/30 px-2 py-1">
                      <Text className="text-xs font-semibold text-foreground">Edit</Text>
                    </TouchableOpacity>
                  </View>

                  <NearbyDriversPanel
                    drivers={nearbyDrivers ?? []}
                    selectedDriver={selectedDriverId}
                    onSelect={handleDriverSelect}
                    sheetState={sheetState}
                    filters={filters}
                    setFilters={setFilters}
                    genderMatch={genderMatch}
                    setGenderMatch={setGenderMatch}
                    riderGender={rider!.gender} // REMINDER GET IT CHECKED OUT, TO SEE IF IM GETTING THE USER THE RIGHT WAY
                    hasSearchedDrivers={hasSearchedDrivers}
                    onFindDriver={() => setHasSearchedDrivers(true)}
                    isSearchingDrivers={isSearchingDrivers}
                  />
                </View>
              </SheetLayer>
            )}

            {/* LAYER 2: Locations not fully set OR planning mode — plan your ride */}
            {(!bothSelected || !showDrivers) && (
              <SheetLayer animatedIndex={animatedIndex} visibleFrom={0.5}>
                <View>
                  {/* Header */}
                  <View className="flex-row items-center px-4 py-2">
                    <TouchableOpacity onPress={() => router.back()} className="p-2">
                      <Ionicons name="arrow-back" size={24} color={'black'} />
                    </TouchableOpacity>
                    <Text className="mr-8 flex-1 text-center text-lg font-bold text-foreground">
                      Plan your ride
                    </Text>
                  </View>

                  {/* Search inputs */}
                  <View className="z-[9999] mt-6 flex-row items-center px-4">
                    <View className="mr-3 w-4 items-center">
                      <View className="h-2 w-2 rounded-full bg-green-500" />
                      <View className="h-14 w-0.5 bg-foreground" />
                      <View className="h-2 w-2 bg-red-500" />
                    </View>
                    <View className="flex-1 rounded-xl border-2 border-foreground bg-background">
                      {/* Pickup */}
                      <View className="z-[2] flex-row items-center border-b-2 border-muted/50">
                        {!apiKey ? (
                          <View className="flex-1 items-center justify-center py-3">
                            <Text className="text-center text-sm text-destructive">
                              Maps API key missing
                            </Text>
                          </View>
                        ) : (
                          <GooglePlacesAutocomplete
                            ref={pickupRef}
                            placeholder={
                              isPickupSearching ? 'Loading current location...' : 'Pickup location'
                            }
                            fetchDetails={true}
                            onPress={handlePickupSelect}
                            textInputProps={{
                              onFocus: () => setMapSelectionMode('pickup'),
                              placeholderTextColor: '#6b7280',
                            }}
                            query={{
                              key: apiKey,
                              language: 'en',
                              sessionToken: pickupSessionToken,
                            }}
                            debounce={400}
                            enablePoweredByContainer={false}
                            onFail={(error) => {
                              console.error('Pickup search failed:', error);
                              setIsPickupSearching(false);
                              showToast({
                                title: 'Search failed',
                                description: error,
                                type: 'error',
                              });
                            }}
                            styles={{
                              container: { flex: 0, width: '100%', zIndex: 1 },
                              textInput: {
                                backgroundColor: 'transparent',
                                height: 50,
                                fontSize: 16,
                                fontWeight: '600',
                                color: 'black',
                                paddingHorizontal: 12,
                              },
                              listView: {
                                position: 'absolute',
                                top: 50,
                                backgroundColor: 'white',
                                maxHeight: 250,
                              },
                              row: { padding: 12, backgroundColor: 'white' },
                              description: { color: 'black' },
                            }}
                          />
                        )}
                      </View>

                      {/* Destination */}
                      <View className="z-[1] flex-row items-center bg-muted/20">
                        {!apiKey ? (
                          <View className="flex-1 items-center justify-center py-3">
                            <Text className="text-center text-sm text-destructive">
                              Maps API key missing
                            </Text>
                          </View>
                        ) : (
                          <GooglePlacesAutocomplete
                            ref={destinationRef}
                            placeholder="Where to?"
                            fetchDetails={true}
                            onPress={handleDestinationSelect}
                            textInputProps={{
                              onFocus: () => setMapSelectionMode('destination'),
                              placeholderTextColor: '#6b7280',
                            }}
                            query={{
                              key: apiKey,
                              language: 'en',
                              sessionToken: destinationSessionToken,
                            }}
                            debounce={400}
                            enablePoweredByContainer={false}
                            onFail={(error) => {
                              console.error('Destination search failed:', error);
                              setIsDestinationSearching(false);
                              showToast({
                                title: 'Search failed',
                                description: error,
                                type: 'error',
                              });
                            }}
                            styles={{
                              container: { flex: 0, width: '100%', zIndex: 2 },
                              textInput: {
                                backgroundColor: 'transparent',
                                height: 50,
                                fontSize: 16,
                                fontWeight: '600',
                                color: 'black',
                                paddingHorizontal: 12,
                              },
                              listView: {
                                position: 'absolute',
                                top: 50,
                                backgroundColor: 'white',
                                zIndex: 3001,
                                maxHeight: 250,
                              },
                              row: { padding: 12, backgroundColor: 'white' },
                              description: { color: 'black' },
                            }}
                          />
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Set location on map accordion */}
                  <View className="-z-10 mt-12 px-4">
                    <TouchableOpacity
                      onPress={() => setIsSetLocationExpanded(!isSetLocationExpanded)}
                      className="flex-row items-center py-2">
                      <View className="mr-3 w-10 items-center justify-center">
                        <MaterialIcons name="location-pin" size={20} color={'black'} />
                      </View>
                      <Text className="flex-1 text-base font-bold text-foreground">
                        Set location on map
                      </Text>
                      <Animated.View style={rotationStyle}>
                        <Feather name="chevron-down" size={20} color={'black'} />
                      </Animated.View>
                    </TouchableOpacity>

                    {isSetLocationExpanded && (
                      <View className="ml-10 gap-2 pb-4">
                        <Button
                          variant="ghost"
                          className="h-auto flex-row justify-start rounded-xl bg-muted/20 px-4 py-2"
                          onPress={async () => {
                            setMapSelectionMode('pickup');
                            setSheetIndex(0);
                            if (pickupLocation?.coords) {
                              fitMap(pickupLocation.coords, 500);
                            } else {
                              fitCurrentMapToCenter();
                            }
                            setTimeout(() => Keyboard.dismiss(), 100);
                          }}>
                          <View
                            className="mr-2 h-2 w-2 rounded-full"
                            style={{ backgroundColor: colors.pickup }}
                          />
                          <Text className="font-semibold text-foreground">Pick up</Text>
                        </Button>

                        <Button
                          variant="ghost"
                          className="h-auto flex-row justify-start rounded-xl bg-muted/20 px-4 py-2"
                          onPress={async () => {
                            setMapSelectionMode('destination');
                            setSheetIndex(0);
                            if (destination?.coords) {
                              fitMap(destination.coords, 500);
                            } else {
                              fitCurrentMapToCenter();
                            }
                            setTimeout(() => Keyboard.dismiss(), 100);
                          }}>
                          <View
                            className="mr-2 h-2 w-2 rounded-full"
                            style={{ backgroundColor: colors.destination }}
                          />
                          <Text className="font-semibold text-foreground">Destination</Text>
                        </Button>
                      </View>
                    )}
                  </View>
                </View>
              </SheetLayer>
            )}

            {/* LAYER 3: Collapsed — map pin selection (always present) */}

            {(bothSelected || showDrivers) && !selectedDriver && (
              <SheetLayer animatedIndex={animatedIndex} visibleFrom={0} visibleUntil={0.5}>
                <View className="px-6 py-2">
                  <Text className="text-center text-xl font-extrabold">Your Plan</Text>

                  <View className="mb-3 w-full gap-2 p-2">
                    <TouchableOpacity
                      onPress={() => fitMap(pickupLocation?.coords)}
                      className="flex-row items-center gap-2 rounded-2xl border-2 border-transparent bg-muted/20">
                      <MaterialCommunityIcons name="map-marker" size={24} color={colors.pickup} />

                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-foreground">
                          {pickupLocation?.title}
                        </Text>
                        <Text className="text-xs text-muted-foreground">Pickup</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => fitMap(destination?.coords)}
                      className="flex-row items-center gap-2 rounded-2xl border-2 border-transparent bg-muted/20">
                      <MaterialCommunityIcons
                        name="map-marker"
                        size={24}
                        color={colors.destination}
                      />

                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-foreground">
                          {destination?.title}
                        </Text>
                        <Text className="text-xs text-muted-foreground">Destination</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Confirm button */}
                  <Button
                    onPress={() => {
                      setSheetIndex(1);
                      if (!hasSearchedDrivers) {
                        setHasSearchedDrivers(true);
                      }
                    }}>
                    <Text className="text-lg font-bold text-secondary">
                      {hasSearchedDrivers ? 'Choose driver' : 'Find My Driver'}
                    </Text>
                  </Button>
                </View>
              </SheetLayer>
            )}

            {(!bothSelected || !showDrivers) && !selectedDriver && (
              <SheetLayer animatedIndex={animatedIndex} visibleFrom={0} visibleUntil={0.5}>
                <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
                  <View className="mb-1 items-center">
                    <Text className="text-xl font-extrabold text-foreground">
                      {mapSelectionMode === 'pickup' ? 'Set pickup location' : 'Set destination'}
                    </Text>
                    <Text className="mt-1 text-sm text-muted-foreground">Drag map to move pin</Text>
                  </View>

                  {/* Mode switcher */}
                  <View className="mb-1 flex-row rounded-xl bg-muted/20 p-1">
                    <TouchableOpacity
                      onPress={() => {
                        setMapSelectionMode('pickup');
                        if (pickupLocation?.coords) fitMap(pickupLocation.coords, 500);
                      }}
                      className={cn('flex-1 items-center rounded-lg py-2', {
                        'bg-background': mapSelectionMode === 'pickup',
                      })}>
                      <Text
                        className={cn('text-sm font-bold text-muted-foreground', {
                          'text-foreground': mapSelectionMode === 'pickup',
                        })}>
                        Pickup
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setMapSelectionMode('destination');
                        if (destination?.coords) fitMap(destination.coords, 500);
                      }}
                      className={cn('flex-1 items-center rounded-lg py-2', {
                        'bg-background': mapSelectionMode !== 'pickup',
                      })}>
                      <Text
                        className={cn('text-sm font-bold text-muted-foreground', {
                          'text-foreground': mapSelectionMode !== 'pickup',
                        })}>
                        Destination
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Search button */}
                  <Button
                    variant="outline"
                    onPress={() => {
                      setSheetIndex(1);
                      setTimeout(() => {
                        if (mapSelectionMode === 'pickup') {
                          pickupRef.current?.focus();
                          setMapSelectionMode('pickup');
                        } else {
                          destinationRef.current?.focus();
                          setMapSelectionMode('destination');
                        }
                      }, 300);
                    }}
                    className="mb-4 h-14 flex-row justify-start rounded-2xl bg-muted/40 px-4">
                    <View
                      className={cn('mr-1 h-2 w-2 rounded-full', {
                        'bg-green-500': mapSelectionMode === 'pickup',
                        'bg-red-500': mapSelectionMode === 'destination',
                      })}
                    />
                    <Text
                      numberOfLines={1}
                      className={cn('mr-2 flex-1 text-base font-semibold text-foreground', {
                        'text-muted-foreground':
                          mapSelectionMode === 'pickup' ? !pickupLocation : !destination,
                      })}>
                      {isUpdatingFromMap
                        ? 'Updating location...'
                        : tempLocation
                          ? tempLocation.title
                          : mapSelectionMode === 'pickup'
                            ? pickupLocation?.title || 'Set pickup'
                            : destination?.title || 'Where to?'}
                    </Text>
                    <Feather name="search" size={20} color={'black'} />
                  </Button>

                  {/* Confirm button */}
                  <Button onPress={confirmLocationFromMap} className="h-14 rounded-xl">
                    <Text className="text-lg font-bold text-secondary">
                      Confirm {mapSelectionMode === 'pickup' ? 'pickup' : 'destination'}
                    </Text>
                  </Button>
                </View>
              </SheetLayer>
            )}
          </View>
        </View>
      </BottomSheet>

      {/* ── Confirmation Bottom Sheet ── */}
      <BottomSheet
        ref={confirmSheetRef}
        index={-1}
        snapPoints={['57%']}
        enablePanDownToClose={false}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: BottomSheetBackgroundColor, borderRadius: 32 }}
        handleIndicatorStyle={{ backgroundColor: BottomSheetIndicatorColor, width: 48, height: 4 }}
        animationConfigs={{ damping: 80, overshootClamping: true, stiffness: 500 }}
        enableHandlePanningGesture={false}
        enableContentPanningGesture={false}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: insets.bottom + 16 }}>
          {/* Header */}
          <View className="mb-2 flex-row items-center">
            <TouchableOpacity onPress={handleCloseConfirm} className="-ml-2 px-2">
              <Ionicons name="arrow-back" size={24} color={'black'} />
            </TouchableOpacity>
            <Text className="mr-6 flex-1 text-center text-xl font-extrabold text-foreground">
              Confirm Ride
            </Text>
          </View>

          {/* Content */}
          <View>
            {selectedDriver && (
              <View className="gap-3">
                {/* Driver card */}
                <View className="flex-row items-center gap-2">
                  <View className="items-center justify-center gap-1.5">
                    <Avatar alt="Profile pic" className="h-12 w-12">
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
                    <GenderAge
                      gender={selectedDriver.driver.userDetails.gender}
                      dob={selectedDriver.driver.userDetails.dob}
                    />
                  </View>
                  <View className="min-w-0 flex-1 gap-2">
                    <Text className="font-semibold text-primary">
                      {selectedDriver.driver.userDetails.firstName}{' '}
                      {selectedDriver.driver.userDetails.lastName}
                    </Text>
                    <Text className="text-xs font-medium">
                      {selectedDriver.driver.organization.name}
                    </Text>

                    <View className="flex-row items-center justify-start">
                      <MaterialCommunityIcons
                        name={VEHICLE_ICONS[selectedDriver.vehicle.class]}
                        size={18}
                        color={colors.primary}
                      />
                      <Text className="ml-1 text-sm capitalize text-slate-600">
                        {selectedDriver.vehicle.model} | {selectedDriver.vehicle.registrationNumber}{' '}
                        | {selectedDriver.vehicle.color}
                      </Text>
                    </View>
                    <View className="mt-0.5 flex-row items-center gap-2">
                      <Rating rating={selectedDriver.driver.rating} />
                      {licenseVerification && (
                        <View className="flex-row items-center gap-1">
                          <Feather
                            name={licenseVerification.icon as any}
                            size={12}
                            color={licenseVerification.color}
                          />
                          <Text
                            style={{ color: licenseVerification.color }}
                            className="text-xs font-semibold">
                            {licenseVerification.label}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                <Separator />

                {/* Trip details */}
                <View className="overflow-hidden rounded-2xl bg-primary/5 p-4">
                  <View className="flex-row gap-2">
                    <MaterialCommunityIcons name="map-marker" size={16} color={colors.pickup} />
                    <Text numberOfLines={1} className="truncate text-sm font-bold text-foreground">
                      {pickupLocation?.title} and we are here
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    <MaterialCommunityIcons
                      name="map-marker"
                      size={16}
                      color={colors.destination}
                    />
                    <Text numberOfLines={1} className="truncate text-sm font-bold text-foreground">
                      {destination?.title}
                    </Text>
                  </View>
                  <View className="mt-3 flex-row items-center justify-between rounded-xl bg-primary/10 px-4 py-1">
                    <Text className="text-sm font-semibold text-muted-foreground">
                      {distanceFormat(selectedRoute?.distance.value ?? 0)}
                    </Text>
                    <Text className="text-lg font-extrabold tracking-wider text-green-600">
                      {formatFare(selectedDriver.fare)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Confirm button pinned to bottom */}
          <Button onPress={handleConfirmRide} className="mt-2">
            <Text className="text-lg font-bold text-secondary">Confirm Ride</Text>
          </Button>
        </View>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}
