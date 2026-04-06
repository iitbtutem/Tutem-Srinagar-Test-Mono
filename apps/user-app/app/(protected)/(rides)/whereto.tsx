import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import uuid from 'react-native-uuid';
import Constants from 'expo-constants';
import { View, TouchableOpacity, Keyboard, ActivityIndicator, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Feather, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import BottomSheet, { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Location from 'expo-location';
import { colorScheme, useColorScheme } from 'nativewind';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { mapStyleDark } from '@/constants/mapStyles';
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

  const [mapSelectionMode, setMapSelectionMode] = useState<'pickup' | 'destination'>('destination');
  const [isSetLocationExpanded, setIsSetLocationExpanded] = useState(false);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [isUpdatingFromMap, setIsUpdatingFromMap] = useState(false);

  const apiKey =
    Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const pickupSessionToken = useRef<string>(uuid.v4() as string).current;
  const destinationSessionToken = useRef<string>(uuid.v4() as string).current;

  const [isPickupSearching, setIsPickupSearching] = useState(false);
  const [isDestinationSearching, setIsDestinationSearching] = useState(false);

  // this is the effect for getting the current location of the user
  useEffect(() => {
    (async () => {
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
    })();
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
    }
  };

  const handleDestinationSelect = async (data: any, details: any = null) => {
    console.log('pressed key : ', data);
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

  const onRegionChangeComplete = async (region: any) => {
    // Only update if we are in COLLAPSED state (manually selecting from map)
    // if (sheetIndex === 0 && !locationLoading) {
    //   setIsUpdatingFromMap(true);
    //   try {
    //     const title = await getAddressFromCoords(region.latitude, region.longitude);
    //     if (mapSelectionMode === 'pickup') {
    //       setPickupLocation({
    //         title,
    //                     coords: { latitude: region.latitude, longitude: region.longitude }
    //       });
    //       pickupRef.current?.setAddressText(title);
    //     } else {
    //       setDestination({
    //         title,
    //                     coords: { latitude: region.latitude, longitude: region.longitude }
    //       });
    //       destinationRef.current?.setAddressText(title);
    //     }
    //   } catch (error) {
    //             console.error("Failed to update location from map", error);
    //   } finally {
    //     setIsUpdatingFromMap(false);
    //   }
    // }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Map Background */}
      <View className="relative flex-1 bg-background">
        <MapView
          ref={mapRef}
          style={{ height: "70%", width: "auto" }}
          customMapStyle={isDark ? mapStyleDark : []}
          onRegionChangeComplete={onRegionChangeComplete}
          initialRegion={{
            latitude: 28.5367,
            longitude: 77.1178,
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
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>

        {/* Center Pin Overlay tracking the map center */}
        {/* <View className="pointer-events-none absolute inset-0 items-center justify-center">
          {locationLoading ? (
            <ActivityIndicator size="large" color={isDark ? 'white' : 'black'} className="-mt-8" />
          ) : (
            <View className="-mt-8 items-center justify-center">
              <View className="h-8 w-8 items-center justify-center rounded-full border-4 border-background bg-foreground shadow-sm">
                <View className="h-2 w-2 rounded-full bg-background" />
              </View>
              <View className="h-4 w-1 bg-foreground" />
              <View className="-mt-2 h-4 w-4 rounded-full border-2 border-background bg-blue-500 opacity-80" />
            </View>
          )}
        </View> */}
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

                {/* Dropdowns */}
                {/* <View className="flex-row px-4 mt-2 gap-2">
                    <TouchableOpacity className="flex-row items-center bg-muted/40 px-3 py-2 rounded-full gap-2">
                        <Feather name="clock" size={16} color={isDark ? "white" : "black"} />
                        <Text className="font-semibold text-sm text-foreground">Pickup now</Text>
                        <Feather name="chevron-down" size={16} color={isDark ? "white" : "black"} />
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-row items-center bg-muted/40 px-3 py-2 rounded-full gap-2">
                        <MaterialIcons name="person" size={16} color={isDark ? "white" : "black"} />
                        <Text className="font-semibold text-sm text-foreground">For me</Text>
                        <Feather name="chevron-down" size={16} color={isDark ? "white" : "black"} />
                    </TouchableOpacity>
                </View> */}

                {/* Active Search Inputs Block using Google Places */}
                <View className="z-[9999] mt-6 flex-row px-4">
                  {/* <View className="items-center mr-3 w-4 pt-4">
                      <View className="w-2 h-2 rounded-full bg-foreground" />
                      <View className="w-0.5 h-10 bg-foreground" />
                      <View className="w-2 h-2 bg-foreground" />
                  </View> */}

                  <View className="flex-1 rounded-xl border-2 border-foreground/20 bg-background">
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
                          // isLoading={isPickupSearching}
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
                          // isLoading={isDestinationSearching}
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
                          // onLoading={() => setIsDestinationSearching(true)}
                          // onClear={() => setIsDestinationSearching(false)}
                        />
                      )}
                    </View>
                  </View>

                  {/* Add stops  */}

                  {/* <View className="w-10 pt-2 ml-3">
                    <TouchableOpacity className="w-10 h-10 bg-muted/30 rounded-full items-center justify-center">
                      <Feather name="plus" size={20} color={isDark ? "white" : "black"} />
                    </TouchableOpacity>
                  </View> */}
                </View>

                {/* Static Bottom Fallbacks (shown when not searching) */}
                <View className="-z-10 mt-12 flex-1 px-4">
                  {/* <TouchableOpacity className="flex-row items-center py-4 border-b border-muted/20">
                    <View className="w-10 items-center justify-center mr-3">
                        <Feather name="globe" size={20} color={isDark ? "white" : "black"} />
                    </View>
                    <Text className="font-bold text-base text-foreground">Search in a different city</Text>
                  </TouchableOpacity> */}

                  {/* Set location on map Accordion */}
                  <>
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
                          variant={'ghost'}
                          className="h-auto flex-row justify-start rounded-xl bg-muted/20 px-4 py-2"
                          onPress={() => {
                            return;
                            setMapSelectionMode('pickup');
                            setSheetIndex(0);
                            if (pickupLocation?.coords) {
                              mapRef.current?.animateToRegion(
                                {
                                  ...pickupLocation.coords,
                                  latitudeDelta: 0.015,
                                  longitudeDelta: 0.015,
                                },
                                1000
                              );
                            }
                          }}>
                          <View className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                          <Text className="font-semibold text-foreground">Pick up</Text>
                        </Button>

                        <Button
                          variant={'ghost'}
                          className="h-auto flex-row justify-start rounded-xl bg-muted/20 px-4 py-2"
                          onPress={() => {
                            return;
                            setMapSelectionMode('destination');
                            setSheetIndex(0);
                            if (destination?.coords) {
                              mapRef.current?.animateToRegion(
                                {
                                  ...destination.coords,
                                  latitudeDelta: 0.015,
                                  longitudeDelta: 0.015,
                                },
                                1000
                              );
                            }
                          }}>
                          <View className="mr-2 h-2 w-2 rounded-full bg-red-500" />
                          <Text className="font-semibold text-foreground">Destination</Text>
                        </Button>
                      </View>
                    )}
                  </>

                  <Button onPress={() => {
                    console.log("Pickup: ", pickupLocation);
                    console.log("Destination: ", destination);
                    // if(pickupLocation?.coords.latitude && destination?.coords.latitude) {
                    //   router.push({
                    //     // pathname: "/(protected)/(rides)/confirm",
                    //     pathname: "/(protected)/(rides)/whereto",
                    //     params: {
                    //       pickup: JSON.stringify(pickupLocation),
                    //       destination: JSON.stringify(destination)
                    //     }
                    //   })
                    // }
                    // return;
                    }} 
                    className="h-14 rounded-xl">
                    <Text className="text-lg font-bold text-secondary">
                      Confirm locations
                    </Text>
                  </Button>
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
                <View className="mb-4 mt-2 items-center">
                  <Text className="text-xl font-extrabold text-foreground">
                    {mapSelectionMode === 'pickup' ? 'Set pick up location' : 'Set destination'}
                  </Text>
                  {/* <Text className="mt-1 text-sm text-muted-foreground">Drag map to move pin</Text> */}
                </View>

                {/* Mode Switcher in Compact View */}
                <View className="mb-4 flex-row rounded-xl bg-muted/20 p-1">
                  <TouchableOpacity
                    onPress={() => {
                      return;
                      setMapSelectionMode('pickup');
                      if (pickupLocation?.coords) {
                        mapRef.current?.animateToRegion(
                          {
                            ...pickupLocation.coords,
                            latitudeDelta: 0.015,
                            longitudeDelta: 0.015,
                          },
                          1000
                        );
                      }
                    }}
                    className={`flex-1 items-center rounded-lg py-2 ${mapSelectionMode === 'pickup' ? 'bg-background shadow-sm' : ''}`}>
                    <Text
                      className={`text-sm font-bold ${mapSelectionMode === 'pickup' ? 'text-foreground' : 'text-muted-foreground'}`}>
                      Pick up
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      return;
                      setMapSelectionMode('destination');
                      if (destination?.coords) {
                        mapRef.current?.animateToRegion(
                          {
                            ...destination.coords,
                            latitudeDelta: 0.015,
                            longitudeDelta: 0.015,
                          },
                          1000
                        );
                      }
                    }}
                    className={`flex-1 items-center rounded-lg py-2 ${mapSelectionMode === 'destination' ? 'bg-background shadow-sm' : ''}`}>
                    <Text
                      className={`text-sm font-bold ${mapSelectionMode === 'destination' ? 'text-foreground' : 'text-muted-foreground'}`}>
                      Destination
                    </Text>
                  </TouchableOpacity>
                </View>

                <Button
                  variant={'outline'}
                  onPress={() => {
                    setSheetIndex(1);
                    mapSelectionMode === 'pickup'
                      ? pickupRef.current.focus()
                      : destinationRef.current.focus();
                  }}
                  className="mb-4 h-14 flex-row justify-start rounded-2xl bg-muted/40 px-4">
                  <View
                    className={`mr-1 h-2 w-2 rounded-full ${mapSelectionMode === 'pickup' ? 'bg-green-500' : 'bg-red-500'}`}
                  />
                  <Text
                    numberOfLines={1}
                    className={`mr-2 flex-1 text-base font-semibold ${(mapSelectionMode === 'pickup' ? !pickupLocation : !destination) ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {isUpdatingFromMap
                      ? 'Updating location...'
                      : mapSelectionMode === 'pickup'
                        ? pickupLocation?.title || 'Set pickup'
                        : destination?.title || 'Where to?'}
                  </Text>
                  <Feather name="search" size={20} color={isDark ? 'white' : 'black'} />
                </Button>

                <Button onPress={() => setSheetIndex(1)} className="h-14 rounded-xl">
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
