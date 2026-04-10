import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import uuid from 'react-native-uuid';
import Constants from 'expo-constants';
import { View, TouchableOpacity, Keyboard, ActivityIndicator, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Feather, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import BottomSheet, { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Location from 'expo-location';
import { colorScheme, useColorScheme } from 'nativewind';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { mapStyle } from '@/constants/mapStyles';
import Animated, {
  useAnimatedStyle,
  interpolate,
  useSharedValue,
  Extrapolation,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useToast } from '@/components/CustomToast';
import { getAddressFromCoords, fetchRoute } from '@/lib/maps';
import { BottomSheetBackgroundColor, BottomSheetIndicatorColor } from '@/constants/colors';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function WhereTo() {
  const { colorScheme: currentTheme } = useColorScheme();
  const isDark = currentTheme === 'dark';

  const { showToast } = useToast();

  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView>(null);
  const pickupRef = useRef<any>(null);
  const destinationRef = useRef<any>(null);

  const router = useRouter();

  // for bottom sheet
  const snapPoints = useMemo(() => ['40%', '90%'], []);
  const [sheetIndex, setSheetIndex] = useState(1);
  const sheetState = sheetIndex >= 1 ? 'FULL' : 'COLLAPSED';

  // for pickup location by default we will set the current location of user
  const [pickupLocation, setPickupLocation] = useState<{
    title: string;
    coords: { latitude: number; longitude: number };
  } | null>(null);

  // for dropoff location by default we will set the current location of user
  const [destination, setDestination] = useState<{
    title: string;
    coords: { latitude: number; longitude: number };
  } | null>(null);

  const [mapSelectionMode, setMapSelectionMode] = useState<'pickup' | 'destination' | null>(
    'destination'
  );
  const [isSetLocationExpanded, setIsSetLocationExpanded] = useState(false);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [isUpdatingFromMap, setIsUpdatingFromMap] = useState(false);

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

  // this is the effect for getting the current location of the user
  async function getCurrentLocation() {
    setIsPickupSearching(true);
    let { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      showToast({ title: 'Location permissions denied', type: 'error' });
      setIsPickupSearching(false);
      return;
    }

    let location = await Location.getCurrentPositionAsync({});

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
        coords: coords,
      });

      mapRef.current?.animateToRegion(
        {
          ...coords,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
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

      const selectedRegion = {
        ...dropoffCoords,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      mapRef.current?.animateToRegion(selectedRegion, 1000);

      // Collapse bottom sheet
      setSheetIndex(0);
      Keyboard.dismiss();
      setMapSelectionMode(null);
    }
  };

  // Effect to fetch route when both markers exist
  useEffect(() => {
    if (pickupLocation?.coords && destination?.coords) {
      (async () => {
        const coords = await fetchRoute(pickupLocation.coords, destination.coords);
        setRouteCoords(coords);

        // Fit map to show both markers
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

  const animatedIndex = useSharedValue(1);

  // Animated Styles for Cross-fade
  const fullStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [0.1, 0.8], [0, 1], Extrapolation.CLAMP),
    zIndex: animatedIndex.value > 0.5 ? 10 : 0,
  }));

  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [0.1, 0.8], [1, 0], Extrapolation.CLAMP),
    zIndex: animatedIndex.value <= 0.5 ? 10 : 0,
  }));

  const rotationStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: withTiming(isSetLocationExpanded ? '180deg' : '0deg') }],
    };
  });

  const handleSheetChanges = useCallback((index: number) => {
    setSheetIndex(index);
    if (index === 0) Keyboard.dismiss();
  }, []);

  const confirmLocationFromMap = () => {
    if (!tempLocation && pickupLocation && destination) {
      setSheetIndex(1);
      return;
    }
    if (!tempLocation) return;

    const { title, latitude, longitude } = tempLocation;
    if (mapSelectionMode === 'pickup') {
      setPickupLocation({
        title: title,
        coords: { latitude, longitude },
      });
      pickupRef.current?.setAddressText(title);
    } else if (mapSelectionMode === 'destination') {
      setDestination({
        title: title,
        coords: { latitude, longitude },
      });
      destinationRef.current?.setAddressText(title);
    }
    setTempLocation(null);
    setSheetIndex(1);
    setMapSelectionMode(null);
    setTimeout(() => {
      if (mapSelectionMode === 'pickup') {
        pickupRef.current?.blur();
      } else if (mapSelectionMode === 'destination') {
        destinationRef.current?.blur();
      }
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

        const coords = mapSelectionMode === 'pickup' 
        ? await fetchRoute({ latitude: region.latitude, longitude: region.longitude }, destination ? destination.coords : { latitude: region.latitude, longitude: region.longitude })
        : await fetchRoute(pickupLocation ? pickupLocation.coords : { latitude: region.latitude, longitude: region.longitude }, { latitude: region.latitude, longitude: region.longitude })
        setRouteCoords(coords);
        
      } catch (error) {
        console.error('Failed to update location from map', error);
      } finally {
        setIsUpdatingFromMap(false);
      }
    }
  };

  const handleLocatePress = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: pickupLocation?.coords?.latitude || 28.5367,
          longitude: pickupLocation?.coords?.longitude || 77.1178,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  };

  const getCurrentMapCenter = async () => {
    if (mapRef.current) {
      const camera = await mapRef.current.getCamera();
      return {
        latitude: camera.center.latitude,
        longitude: camera.center.longitude,
      };
    }
    return null;
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Map Background */}
      <View className="relative h-2/3 bg-background">
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          showsUserLocation
          followsUserLocation
          showsMyLocationButton={false}
          mapPadding={{
            top: 10,
            right: 10,
            bottom: 10,
            left: 10,
          }}
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
          {/* Pickup marker */}
          {pickupLocation?.coords && (
            <Marker coordinate={pickupLocation.coords} anchor={{ x: 0.5, y: 0.5 }}>
              <MaterialCommunityIcons name="map-marker" size={30} color="green" />
            </Marker>
          )}

          {/* Dropoff marker */}
          {destination?.coords && (
            <Marker coordinate={destination.coords} anchor={{ x: 0.5, y: 1 }}>
              <MaterialCommunityIcons name="map-marker" size={30} color="red" />
            </Marker>
          )}

          {/* Route polyline — drawn from decoded coordinates */}
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

        {/* Center Pin Overlay - Only show when in selection mode */}
        {(sheetState === 'COLLAPSED' && mapSelectionMode !== null) && (
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

      {/* Draggable Bottom Sheet Layer */}
      <BottomSheet
        ref={bottomSheetRef}
        index={sheetIndex}
        animatedIndex={animatedIndex}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        backgroundStyle={{
          backgroundColor: BottomSheetBackgroundColor,
          borderRadius: 32,
        }}
        handleIndicatorStyle={{ backgroundColor: BottomSheetIndicatorColor, width: 48, height: 4 }}
        animationConfigs={{
          damping: 80,
          overshootClamping: true,
          stiffness: 500,
        }}
        keyboardBehavior="extend">
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          {/* CONTAINER FOR BOTH VIEWS TO ALLOW CROSS-FADE */}
          <View style={{ flex: 1 }}>
            {/* EXPANDED FULL-SCREEN STATE (Plan your ride) */}
            <Animated.View
              style={fullStyle}
              className="flex-1"
              pointerEvents={sheetState === 'FULL' ? 'auto' : 'none'}>
              <View className="flex-1">
                {/* Header */}
                <View className="flex-row items-center px-4 py-2">
                  <TouchableOpacity onPress={() => router.back()} className="p-2">
                    <Ionicons name="arrow-back" size={24} color={isDark ? 'white' : 'black'} />
                  </TouchableOpacity>
                  <Text className="mr-8 flex-1 text-center text-lg font-bold text-foreground">
                    Plan your ride
                  </Text>
                </View>

                {/* Active Search Inputs Block using Google Places */}
                <View className="z-[9999] mt-6 flex-row items-center px-4">
                  <View className="items-center mr-3 w-4">
                    <View className="w-2 h-2 rounded-full bg-green-500" />
                    <View className="w-0.5 h-14 bg-foreground" />
                    <View className="w-2 h-2 bg-red-500" />
                  </View>
                  <View className="flex-1 rounded-xl border-2 border-foreground bg-background">
                    {/* Pickup Location Autocomplete */}
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
                              color: isDark ? 'white' : 'black',
                              paddingHorizontal: 12,
                            },
                            listView: {
                              position: 'absolute',
                              top: 50,
                              backgroundColor: isDark ? '#1C1C1E' : 'white',
                              maxHeight: 250,
                            },
                            row: {
                              padding: 12,
                              backgroundColor: isDark ? '#1C1C1E' : 'white',
                            },
                            description: { color: isDark ? '#E5E5E7' : 'black' },
                          }}
                        />
                      )}
                    </View>

                    {/* Destination Location Autocomplete */}
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

                {/* Static Bottom Fallbacks (shown when not searching) */}
                <View className="-z-10 mt-12 flex-1 px-4">
                  {/* Set location on map Accordion */}
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

                  {/* FIXED: Set location on map buttons */}
                  {isSetLocationExpanded && (
                    <View className="ml-10 gap-2 pb-4">
                      <Button
                        variant={'ghost'}
                        className="h-auto flex-row justify-start rounded-xl bg-muted/20 px-4 py-2"
                        onPress={async () => {
                          setMapSelectionMode('pickup');
                          setSheetIndex(0); // Collapse bottom sheet to enter selection mode
                          // Animate to current pickup location if exists, otherwise use center of map
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
                            // Get current map center
                            const center = await getCurrentMapCenter();
                            if (center) {
                              mapRef.current?.animateToRegion(
                                {
                                  latitude: center.latitude,
                                  longitude: center.longitude,
                                  latitudeDelta: 0.015,
                                  longitudeDelta: 0.015,
                                },
                                500
                              );
                            }
                          }
                          // Small delay to ensure sheet is collapsed
                          setTimeout(() => {
                            Keyboard.dismiss();
                          }, 100);
                        }}>
                        <View className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                        <Text className="font-semibold text-foreground">Pick up</Text>
                      </Button>

                      <Button
                        variant={'ghost'}
                        className="h-auto flex-row justify-start rounded-xl bg-muted/20 px-4 py-2"
                        onPress={async () => {
                          setMapSelectionMode('destination');
                          setSheetIndex(0); // Collapse bottom sheet to enter selection mode
                          // Animate to current destination if exists
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
                            // Get current map center
                            const center = await getCurrentMapCenter();
                            if (center) {
                              mapRef.current?.animateToRegion(
                                {
                                  latitude: center.latitude,
                                  longitude: center.longitude,
                                  latitudeDelta: 0.015,
                                  longitudeDelta: 0.015,
                                },
                                500
                              );
                            }
                          }
                          setTimeout(() => {
                            Keyboard.dismiss();
                          }, 100);
                        }}>
                        <View className="mr-2 h-2 w-2 rounded-full bg-red-500" />
                        <Text className="font-semibold text-foreground">Destination</Text>
                      </Button>
                    </View>
                  )}
                </View>
              </View>
            </Animated.View>

            {/* COMPACT STATE (Map Selection View) */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  pointerEvents: 'box-none' as const,
                },
                compactStyle,
              ]}
              pointerEvents={sheetState === 'COLLAPSED' ? 'auto' : 'none'}>
              <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
                <View className="mb-4 items-center">
                  <Text className="text-xl font-extrabold text-foreground">
                    {mapSelectionMode === 'pickup' ? 'Set pickup location' : 'Set destination'}
                  </Text>
                  <Text className="mt-1 text-sm text-muted-foreground">Drag map to move pin</Text>
                </View>

                {/* FIXED: Mode Switcher in Compact View */}
                <View className="mb-4 flex-row rounded-xl bg-muted/20 p-1">
                  <TouchableOpacity
                    onPress={() => {
                      setMapSelectionMode('pickup');
                      // Animate to current pickup location if exists
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
                      // Animate to current destination if exists
                      if (destination?.coords) {
                        mapRef.current?.animateToRegion(
                          {
                            ...destination.coords,
                            latitudeDelta: 0.015,
                            longitudeDelta: 0.015,
                          },
                          500
                        );
                      }
                    }}
                    className={cn('flex-1 items-center rounded-lg py-2', {
                      'bg-background': mapSelectionMode === 'destination',
                    })}>
                    <Text
                      className={cn('text-sm font-bold text-muted-foreground', {
                        'text-foreground': mapSelectionMode === 'destination',
                      })}>
                      Destination
                    </Text>
                  </TouchableOpacity>
                </View>

                <Button
                  variant={'outline'}
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

                {/* FIXED: Confirm button */}
                <Button onPress={confirmLocationFromMap} className="h-14 rounded-xl">
                  <Text className="text-lg font-bold text-secondary">
                    Confirm {mapSelectionMode === 'pickup' ? 'pickup' : 'destination'}
                  </Text>
                </Button>
              </View>
            </Animated.View>
          </View>
        </View>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}
