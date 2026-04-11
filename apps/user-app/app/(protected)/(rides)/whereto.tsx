import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import uuid from 'react-native-uuid';
import Constants from 'expo-constants';
import {
  View,
  TouchableOpacity,
  Keyboard,
  ActivityIndicator,
  ScrollView,
  BackHandler,
  Image,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { Feather, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import BottomSheet from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Location from 'expo-location';
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
} from 'react-native-reanimated';
import { useToast } from '@/components/CustomToast';
import { getAddressFromCoords, fetchRoute } from '@/lib/maps';
import {
  BottomSheetBackgroundColor,
  BottomSheetIndicatorColor,
  iconColor,
} from '@/constants/colors';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQuery } from 'convex/react';
import { api } from '@tutem/api';
import { SelectContent } from '@/components/ui/select';

// ─── SheetLayer ───────────────────────────────────────────────────────────────
type SheetLayerProps = {
  children: React.ReactNode;
  animatedIndex: SharedValue<number>;
  visibleFrom?: number;
  visibleUntil?: number;
};

function SheetLayer({ children, animatedIndex, visibleFrom = 0, visibleUntil }: SheetLayerProps) {
  const style = useAnimatedStyle(() => {
    const inputRange =
      visibleUntil !== undefined
        ? [visibleFrom - 0.3, visibleFrom, visibleUntil, visibleUntil + 0.3]
        : [visibleFrom - 0.3, visibleFrom];

    const outputRange = visibleUntil !== undefined ? [0, 1, 1, 0] : [0, 1];

    const opacity = interpolate(animatedIndex.value, inputRange, outputRange, Extrapolation.CLAMP);

    return {
      opacity,
      pointerEvents: opacity > 0.1 ? 'auto' : 'none',
    };
  });

  return (
    <Animated.View
      style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, style]}
      pointerEvents="box-none">
      {children}
    </Animated.View>
  );
}

// ─── NearbyDriversPanel ───────────────────────────────────────────────────────
type Driver = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

type NearbyDriversPanelProps = {
  drivers: Driver[];
  selectedDriver: string | null;
  onSelect: (id: string) => void;
  sheetState: 'FULL' | 'COLLAPSED';
  isDark: boolean;
};

function NearbyDriversPanel({
  drivers,
  selectedDriver,
  onSelect,
  sheetState,
  isDark,
}: NearbyDriversPanelProps) {
  if (!drivers || drivers.length === 0)
    return (
      <View className="flex-1 items-center justify-center py-8">
        <Text className="text-sm text-muted-foreground">No drivers available nearby</Text>
      </View>
    );

  return (
    <View className="mb-6 px-4 pt-2">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-foreground">Nearby drivers</Text>
        <Text className="text-xs text-muted-foreground">{drivers.length} available</Text>
      </View>

      <ScrollView
        // horizontal={sheetState === 'COLLAPSED'}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          gap: 3,
        }}>
        {drivers.map((driver) => {
          const isSelected = selectedDriver === driver.id;

          return (
            <TouchableOpacity
              key={driver.id}
              onPress={() => onSelect(driver.id)}
              activeOpacity={0.75}
              style={{ minWidth: 130 }}
              className={cn(
                'flex-row items-center gap-2 rounded-2xl border-2 px-3 py-2',
                isSelected ? 'border-foreground bg-foreground/10' : 'border-transparent bg-muted/20'
              )}>
              <View
                className={cn(
                  'h-9 w-9 items-center justify-center rounded-full',
                  isSelected ? 'bg-background' : 'bg-foreground'
                )}>
                <MaterialIcons
                  name={'directions-car'}
                  size={24}
                  color={isSelected ? 'white' : 'black'}
                />
              </View>

              <View className="flex-1">
                <Text numberOfLines={1} className="text-sm font-semibold text-foreground">
                  {driver.name}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {driver.latitude.toFixed(4)}, {driver.longitude.toFixed(4)}
                </Text>
              </View>

              {isSelected && <View className="h-2 w-2 rounded-full bg-green-500" />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── WhereTo ──────────────────────────────────────────────────────────────────
export default function WhereTo() {
  const { colorScheme: currentTheme } = useColorScheme();
  const isDark = currentTheme === 'dark';

  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const bottomSheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView>(null);
  const pickupRef = useRef<any>(null);
  const destinationRef = useRef<any>(null);

  const snapPoints = useMemo(() => ['40%', '90%'], []);
  const [sheetIndex, setSheetIndex] = useState(1);
  const sheetState = sheetIndex >= 1 ? 'FULL' : 'COLLAPSED';

  const [pickupLocation, setPickupLocation] = useState<{
    title: string;
    coords: { latitude: number; longitude: number };
  } | null>(null);

  const [destination, setDestination] = useState<{
    title: string;
    coords: { latitude: number; longitude: number };
  } | null>(null);

  const [isPickupSetAutomatically, setIsPickupSetAutomatically] = useState(false);

  const bothSelected = !!(pickupLocation && destination);

  const [mapSelectionMode, setMapSelectionMode] = useState<'pickup' | 'destination' | null>(
    'destination'
  );
  const [isSetLocationExpanded, setIsSetLocationExpanded] = useState(false);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [isUpdatingFromMap, setIsUpdatingFromMap] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  // Track if we're in driver selection mode
  const [showDrivers, setShowDrivers] = useState(false);

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

  // Only fires when both locations are selected
  const nearbyDrivers = useQuery(
    api.routes.rides.getNearebyDrivers,
    bothSelected && showDrivers
      ? {
          latitude: pickupLocation!.coords.latitude,
          longitude: pickupLocation!.coords.longitude,
        }
      : 'skip'
  );

  async function getCurrentLocation() {
    setIsPickupSearching(true);
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      showToast({ title: 'Location permissions denied', type: 'error' });
      setIsPickupSearching(false);
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    const newRegion = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    };

    const title = await getAddressFromCoords(location.coords.latitude, location.coords.longitude);
    pickupRef.current?.setAddressText(title);
    setPickupLocation({
      title,
      coords: { latitude: location.coords.latitude, longitude: location.coords.longitude },
    });

    mapRef.current?.animateToRegion(newRegion, 1000);
    setIsPickupSearching(false);
  }

  useEffect(() => {
    getCurrentLocation();
  }, []);

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
      mapRef.current?.animateToRegion(
        { ...coords, latitudeDelta: 0.015, longitudeDelta: 0.015 },
        1000
      );
      setMapSelectionMode(null);
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
      mapRef.current?.animateToRegion(
        { ...dropoffCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        1000
      );

      // If pickup location is null, set it to current location
      if (!pickupLocation && !isPickupSetAutomatically) {
        setIsPickupSetAutomatically(true);
        await getCurrentLocation();
      }

      // Auto-show drivers panel when destination is selected
      setShowDrivers(true);
      setSheetIndex(1);
      Keyboard.dismiss();
      setMapSelectionMode(null);
    }
  };

  const handleBackToPlanning = () => {
    pickupRef.current?.setAddressText(pickupLocation?.title || '');
    setDestination(null);
    setShowDrivers(false);
    setSelectedDriverId(null);
    setSheetIndex(1);
  };

  const confirmLocationFromMap = () => {
    if (!tempLocation && pickupLocation && destination) {
      setSheetIndex(1);
      return;
    }
    if (!tempLocation) return;

    const { title, latitude, longitude } = tempLocation;
    if (mapSelectionMode === 'pickup') {
      setPickupLocation({ title, coords: { latitude, longitude } });
      pickupRef.current?.setAddressText(title);
    } else if (mapSelectionMode === 'destination') {
      setDestination({ title, coords: { latitude, longitude } });
      destinationRef.current?.setAddressText(title);
      setShowDrivers(true);
    }
    setTempLocation(null);
    setSheetIndex(1);
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

        const coords =
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
        setRouteCoords(coords);
      } catch (error) {
        console.error('Failed to update location from map', error);
      } finally {
        setIsUpdatingFromMap(false);
      }
    }
  };

  const handleLocatePress = () => {
    mapRef.current?.animateToRegion(
      {
        latitude: pickupLocation?.coords?.latitude || 28.5367,
        longitude: pickupLocation?.coords?.longitude || 77.1178,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      1000
    );
  };

  const getCurrentMapCenter = async () => {
    if (mapRef.current) {
      const camera = await mapRef.current.getCamera();
      return { latitude: camera.center.latitude, longitude: camera.center.longitude };
    }
    return null;
  };

  useEffect(() => {
    if (!!pickupLocation) pickupRef.current?.setAddressText(pickupLocation.title);
    destinationRef.current?.focus();
  }, [bothSelected, showDrivers]);

  // Update route when locations change
  useEffect(() => {
    if (pickupLocation?.coords && destination?.coords) {
      (async () => {
        const coords = await fetchRoute(pickupLocation.coords, destination.coords);
        setRouteCoords(coords);
        if (coords.length > 0) {
          mapRef.current?.fitToCoordinates([pickupLocation.coords, destination.coords], {
            edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
            animated: true,
          });
        }
      })();
    } else {
      setRouteCoords([]);
    }
  }, [pickupLocation?.coords, destination?.coords]);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showDrivers) {
        // Go back to planning mode instead of exiting
        handleBackToPlanning();
        return true; // Prevent default back behavior
      }
      return false; // Allow default back behavior
    });

    return () => backHandler.remove();
  }, [showDrivers, handleBackToPlanning]);

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(isSetLocationExpanded ? '180deg' : '0deg') }],
  }));

  const handleSheetChanges = useCallback((index: number) => {
    setSheetIndex(index);
    if (index === 0) Keyboard.dismiss();
  }, []);

  const selectedDriver = nearbyDrivers?.find((driver) => driver.id === selectedDriverId);

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
          customMapStyle={isDark ? mapStyle.dark : []}
          onRegionChangeComplete={onRegionChangeComplete}
          initialRegion={{
            latitude: 34.5367,
            longitude: 74.1178,
            latitudeDelta: 0.3,
            longitudeDelta: 0.3,
          }}>
          {nearbyDrivers?.map((driver) => (
            <Marker
              key={driver.id}
              coordinate={{
                latitude: driver.latitude,
                longitude: driver.longitude,
              }}
              anchor={{ x: 0, y: 0 }}>
              {/* <MaterialCommunityIcons name="car-hatchback" size={30} color={iconColor} /> */}
              <Image
                source={require('@/assets/images/top_cab.png')}
                style={{ width: 40, height: 40 }}
                resizeMode="contain"
              />
            </Marker>
          ))}
          {pickupLocation?.coords && (
            <Marker coordinate={pickupLocation.coords} anchor={{ x: 0.5, y: 0.5 }}>
              <MaterialCommunityIcons name="map-marker" size={30} color="green" />
            </Marker>
          )}
          {destination?.coords && (
            <Marker coordinate={destination.coords} anchor={{ x: 0.5, y: 1 }}>
              <MaterialCommunityIcons name="map-marker" size={30} color="red" />
            </Marker>
          )}
          {routeCoords.length > 0 && (
            <Polyline
              coordinates={routeCoords}
              strokeWidth={4}
              strokeColor={isDark ? '#60a5fa' : '#1a1a2e'}
              fillColor={isDark ? '#cb97f7' : '#7800e0'}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>

        {sheetState === 'COLLAPSED' && (
          <TouchableOpacity
            className="absolute left-5 top-16 z-0 h-12 w-12 items-center justify-center rounded-full bg-muted shadow-lg"
            onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={iconColor} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          className="absolute bottom-16 right-5 z-0 h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg"
          style={{ elevation: 5 }}
          onPress={handleLocatePress}
          activeOpacity={0.8}>
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={24}
            color={isDark ? '#60a5fa' : '#1a73e8'}
          />
        </TouchableOpacity>

        {sheetState === 'COLLAPSED' && mapSelectionMode !== null && (
          <View className="pointer-events-none absolute inset-0 items-center justify-center">
            {isPickupSearching || isDestinationSearching ? (
              <ActivityIndicator
                size="large"
                color={isDark ? 'white' : 'black'}
                className="-mt-8"
              />
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
            {bothSelected && showDrivers && (
              <SheetLayer animatedIndex={animatedIndex} visibleFrom={0.5}>
                <View style={{ paddingVertical: 0 }}>
                  {/* Header with back option to re-plan */}
                  <View className="flex-row items-center px-4 py-2">
                    <TouchableOpacity onPress={handleBackToPlanning} className="p-2">
                      <Ionicons name="arrow-back" size={24} color={isDark ? 'white' : 'black'} />
                    </TouchableOpacity>
                    <Text className="mr-8 flex-1 text-center text-lg font-bold text-foreground">
                      Choose a driver
                    </Text>
                  </View>

                  {/* Route summary pill */}
                  <View className="mx-4 mb-3 flex-row items-center gap-2 rounded-2xl bg-muted/20 px-4 py-3">
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
                    onSelect={(id) => {
                      setSheetIndex(0);
                      setSelectedDriverId(id);
                    }}
                    sheetState={sheetState}
                    isDark={isDark}
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
                      <Ionicons name="arrow-back" size={24} color={isDark ? 'white' : 'black'} />
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
                            textInputProps={{ onFocus: () => setMapSelectionMode('pickup') }}
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
                                color: isDark ? 'white' : 'black',
                                paddingHorizontal: 12,
                              },
                              listView: {
                                position: 'absolute',
                                top: 50,
                                backgroundColor: isDark ? '#1C1C1E' : 'white',
                                maxHeight: 250,
                              },
                              row: { padding: 12, backgroundColor: isDark ? '#1C1C1E' : 'white' },
                              description: { color: isDark ? '#E5E5E7' : 'black' },
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
                            textInputProps={{ onFocus: () => setMapSelectionMode('destination') }}
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
                                color: isDark ? 'white' : 'black',
                                paddingHorizontal: 12,
                              },
                              listView: {
                                position: 'absolute',
                                top: 50,
                                backgroundColor: isDark ? '#1C1C1E' : 'white',
                                zIndex: 3001,
                                maxHeight: 250,
                              },
                              row: { padding: 12, backgroundColor: isDark ? '#1C1C1E' : 'white' },
                              description: { color: isDark ? '#E5E5E7' : 'black' },
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
                        <MaterialIcons
                          name="location-pin"
                          size={20}
                          color={isDark ? 'white' : 'black'}
                        />
                      </View>
                      <Text className="flex-1 text-base font-bold text-foreground">
                        Set location on map
                      </Text>
                      <Animated.View style={rotationStyle}>
                        <Feather name="chevron-down" size={20} color={isDark ? 'white' : 'black'} />
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
                              mapRef.current?.animateToRegion(
                                {
                                  ...pickupLocation.coords,
                                  latitudeDelta: 0.015,
                                  longitudeDelta: 0.015,
                                },
                                500
                              );
                            } else {
                              const center = await getCurrentMapCenter();
                              if (center) {
                                mapRef.current?.animateToRegion(
                                  { ...center, latitudeDelta: 0.015, longitudeDelta: 0.015 },
                                  500
                                );
                              }
                            }
                            setTimeout(() => Keyboard.dismiss(), 100);
                          }}>
                          <View className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                          <Text className="font-semibold text-foreground">Pick up</Text>
                        </Button>

                        <Button
                          variant="ghost"
                          className="h-auto flex-row justify-start rounded-xl bg-muted/20 px-4 py-2"
                          onPress={async () => {
                            setMapSelectionMode('destination');
                            setSheetIndex(0);
                            if (destination?.coords) {
                              mapRef.current?.animateToRegion(
                                {
                                  ...destination.coords,
                                  latitudeDelta: 0.015,
                                  longitudeDelta: 0.015,
                                },
                                500
                              );
                            } else {
                              const center = await getCurrentMapCenter();
                              if (center) {
                                mapRef.current?.animateToRegion(
                                  { ...center, latitudeDelta: 0.015, longitudeDelta: 0.015 },
                                  500
                                );
                              }
                            }
                            setTimeout(() => Keyboard.dismiss(), 100);
                          }}>
                          <View className="mr-2 h-2 w-2 rounded-full bg-red-500" />
                          <Text className="font-semibold text-foreground">Destination</Text>
                        </Button>
                      </View>
                    )}
                  </View>
                </View>
              </SheetLayer>
            )}

            {/* LAYER 3: Collapsed — map pin selection (always present) */}

            {(bothSelected || showDrivers) && selectedDriver && (
              <SheetLayer animatedIndex={animatedIndex} visibleFrom={0} visibleUntil={0.5}>
                <View style={{ paddingHorizontal: 24, paddingVertical: 10 }}>
                  <View className="mb-2 items-center">
                    <Text className="text-xl font-extrabold text-foreground">Your ride</Text>
                  </View>

                  <View className="mb-3 gap-4 rounded-2xl bg-background p-4 shadow-sm">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 flex-row items-center gap-3">
                        <View className="h-12 w-12 items-center justify-center rounded-full bg-muted">
                          <Text className="text-sm font-bold text-foreground">
                            {selectedDriver.name?.[0]}
                          </Text>
                        </View>

                        <View>
                          <Text className="text-base font-semibold text-foreground">
                            {selectedDriver.name}
                          </Text>
                          <View className="mt-0.5 flex-row items-center gap-1">
                            <Text className="text-yellow-500">★</Text>
                            <Text className="text-sm text-muted-foreground">5.0</Text>
                          </View>
                        </View>
                      </View>

                      <View className="items-end">
                        <Text className="text-sm font-medium text-foreground">Heavy Tipper</Text>
                        <Text className="text-xs tracking-wide text-muted-foreground">
                          JK-WILRUIN-ROADS
                        </Text>
                      </View>
                    </View>

                    <View className="h-[1px] bg-border" />

                    <View className="flex-row items-center justify-between rounded-xl bg-muted/30 p-3">
                      <View>
                        <Text className="text-muted-foreground">Arriving in</Text>
                        <Text className="text-lg font-bold text-foreground">7 min</Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-lg font-bold text-foreground">$420.69</Text>
                        <Text className="text-sm text-muted-foreground">25 km</Text>
                      </View>
                    </View>
                  </View>

                  {/* Confirm button */}
                  <Button onPress={() => console.log('Confirm Ride')} className="h-14 rounded-xl">
                    <Text className="text-lg font-bold text-secondary">Confirm Ride</Text>
                  </Button>
                </View>
              </SheetLayer>
            )}

            {(bothSelected || showDrivers) && !selectedDriver && (
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
                          {pickupLocation?.title}
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
                          {destination?.title}
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
                        if (pickupLocation?.coords) {
                          mapRef.current?.animateToRegion(
                            {
                              ...pickupLocation.coords,
                              latitudeDelta: 0.015,
                              longitudeDelta: 0.015,
                            },
                            500
                          );
                        }
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
                        if (destination?.coords) {
                          mapRef.current?.animateToRegion(
                            { ...destination.coords, latitudeDelta: 0.015, longitudeDelta: 0.015 },
                            500
                          );
                        }
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
                    <Feather name="search" size={20} color={isDark ? 'white' : 'black'} />
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
    </GestureHandlerRootView>
  );
}
