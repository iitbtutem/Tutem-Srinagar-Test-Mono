import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Keyboard, ActivityIndicator, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Feather, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import BottomSheet from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Location from 'expo-location';
import { colorScheme, useColorScheme } from 'nativewind';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { mapStyleDark } from '@/constants/mapStyles';
import Animated, { useAnimatedStyle, interpolate, useSharedValue, Extrapolation, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { useToast } from '@/components/CustomToast';
import { getAddressFromCoords, fetchRoute } from '@/lib/maps';


export default function WhereTo() {
    const { colorScheme: currentTheme } = useColorScheme();
    const isDark = currentTheme === 'dark';

    const { showToast } = useToast()

    const insets = useSafeAreaInsets();
    const bottomSheetRef = useRef<BottomSheet>(null);
    const mapRef = useRef<MapView>(null);
    const pickupRef = useRef<any>(null);
    const destinationRef = useRef<any>(null);

    // for bottom sheet
    const snapPoints = useMemo(() => ['40%', '90%'], []);
    const [sheetIndex, setSheetIndex] = useState(1);
    const sheetState = sheetIndex >= 1 ? "FULL" : "COLLAPSED";

    // for pickup location by default we will set the current location of user
    const [pickupLocation, setPickupLocation] = useState<{ title: string, coords: { latitude: number; longitude: number } } | null>(null);

    // for dropoff location by default we will set the current location of user
    const [destination, setDestination] = useState<{ title: string, coords: { latitude: number; longitude: number } } | null>(null);


    const [locationLoading, setLocationLoading] = useState(true);
    const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);


    // this is the effect for getting the current location of the user
    useEffect(() => {
        (async () => {
            setLocationLoading(true);
            let { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                showToast({ title: "Location permissions denied", type: "error" });
                setLocationLoading(false);
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
                coords: { latitude: location.coords.latitude, longitude: location.coords.longitude }
            });

            mapRef.current?.animateToRegion(newRegion, 1000);

            setLocationLoading(false);
        })();
    }, []);


    const handlePickupSelect = async (data: any, details: any = null) => {
        if (details?.geometry?.location) {
            const coords = {
                latitude: details.geometry.location.lat,
                longitude: details.geometry.location.lng,
            };

            setPickupLocation({
                title: data.description || data.structured_formatting?.main_text || "Selected Location",
                coords: coords
            });

            mapRef.current?.animateToRegion({
                ...coords,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
            }, 1000);
        }
    };

    const handleDestinationSelect = async (data: any, details: any = null) => {
        if (details?.geometry?.location) {
            const dropoffCoords = {
                latitude: details.geometry.location.lat,
                longitude: details.geometry.location.lng,
            };

            setDestination({
                title: data.description || data.structured_formatting?.main_text || "Selected Destination",
                coords: dropoffCoords
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
        zIndex: animatedIndex.value > 0.5 ? 10 : 0
    }));

    const compactStyle = useAnimatedStyle(() => ({
        opacity: interpolate(animatedIndex.value, [0.1, 0.8], [1, 0], Extrapolation.CLAMP),
        zIndex: animatedIndex.value <= 0.5 ? 10 : 0
    }));

    const handleSheetChanges = useCallback((index: number) => {
        setSheetIndex(index);
        if (index === 0) Keyboard.dismiss();
    }, []);

    const [isUpdatingFromMap, setIsUpdatingFromMap] = useState(false);

    const onRegionChangeComplete = async (region: any) => {
        // Only update if we are in COLLAPSED state (manually selecting destination)
        if (sheetIndex === 0 && !locationLoading) {
            setIsUpdatingFromMap(true);
            try {
                const title = await getAddressFromCoords(region.latitude, region.longitude);
                setDestination({
                    title,
                    coords: { latitude: region.latitude, longitude: region.longitude }
                });
                // Update the search input text as well
                destinationRef.current?.setAddressText(title);
            } catch (error) {
                console.error("Failed to update destination from map", error);
            } finally {
                setIsUpdatingFromMap(false);
            }
        }
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>

            {/* Map Background */}
            <View className="flex-1 relative bg-background">
                <MapView
                    ref={mapRef}
                    style={{ flex: 1 }}
                    customMapStyle={isDark ? mapStyleDark : []}
                    onRegionChangeComplete={onRegionChangeComplete}
                    initialRegion={{
                        latitude: 28.5367,
                        longitude: 77.1178,
                        latitudeDelta: 0.3,
                        longitudeDelta: 0.3,
                    }}
                >
                    {/* Pickup marker */}
                    {pickupLocation?.coords && <Marker coordinate={pickupLocation.coords} anchor={{ x: 0.5, y: 0.5 }}>
                        <MaterialCommunityIcons name="map-marker" size={30} color="green" />
                    </Marker>}

                    {/* Dropoff marker */}
                    {destination?.coords && <Marker coordinate={destination.coords} anchor={{ x: 0.5, y: 1 }}>
                        <MaterialCommunityIcons name="map-marker" size={30} color="red" />
                    </Marker>}

                    {/* Route polyline — drawn from decoded coordinates */}
                    {routeCoords.length > 0 && (
                        <Polyline
                            coordinates={routeCoords}
                            strokeWidth={4}
                            strokeColor={isDark ? "#60a5fa" : "#1a1a2e"}
                            lineCap="round"
                            lineJoin="round"
                        />
                    )}
                </MapView>

                {/* Center Pin Overlay tracking the map center */}
                <View className="absolute inset-0 items-center justify-center pointer-events-none">
                    {locationLoading ? (
                        <ActivityIndicator size="large" color={isDark ? "white" : "black"} className="-mt-8" />
                    ) : (
                        <View className="items-center justify-center -mt-8">
                            <View className="w-8 h-8 bg-foreground rounded-full items-center justify-center border-4 border-background shadow-sm">
                                <View className="w-2 h-2 bg-background rounded-full" />
                            </View>
                            <View className="w-1 h-4 bg-foreground" />
                            <View className="w-4 h-4 bg-blue-500 rounded-full border-2 border-background opacity-80 -mt-2" />
                        </View>
                    )}
                </View>
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
                    backgroundColor: isDark ? '#1C1C1E' : 'white',
                    borderRadius: 32, // Consistent border radius for smoother snapping
                }}
                handleIndicatorStyle={{ backgroundColor: isDark ? '#3A3A3C' : '#D1D1D6', width: 48, height: 4 }}
                animationConfigs={{
                    damping: 80,
                    overshootClamping: true,
                    stiffness: 500,
                }}
                keyboardBehavior='extend'
            >
                <View style={{ flex: 1, paddingBottom: insets.bottom }}>

                    {/* CONTAINER FOR BOTH VIEWS TO ALLOW CROSS-FADE */}
                    <View style={{ flex: 1 }}>
                        {/* EXPANDED FULL-SCREEN STATE (Plan your ride) */}
                        <Animated.View style={[{ flex: 1 }, fullStyle]} pointerEvents={sheetState === "FULL" ? "auto" : "none"}>
                            <View style={{ flex: 1 }}>
                                {/* Header */}
                                <View className="flex-row items-center px-4 py-2">
                                    <TouchableOpacity onPress={() => {
                                        setSheetIndex(0);
                                        Keyboard.dismiss();
                                    }} className="p-2">
                                        <Ionicons name="arrow-back" size={24} color={isDark ? "white" : "black"} />
                                    </TouchableOpacity>
                                    <Text className="flex-1 text-center text-lg font-bold mr-8 text-foreground">Plan your ride</Text>
                                </View>

                                {/* Dropdowns */}
                                <View className="flex-row px-4 mt-2 gap-2">
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
                                </View>

                                {/* Active Search Inputs Block using Google Places */}
                                <View className="flex-row px-4 mt-6 z-50">
                                    <View className="items-center mr-3 w-4 pt-4">
                                        <View className="w-2 h-2 rounded-full bg-foreground" />
                                        <View className="w-0.5 h-10 bg-foreground" />
                                        <View className="w-2 h-2 bg-foreground" />
                                    </View>                                    <View className="flex-1 border-2 border-foreground/20 rounded-xl bg-background overflow-hidden">
                                        {/* Pickup Location Autocomplete */}
                                        <View className="flex-row items-center border-b-2 border-muted/50 z-[1000]">
                                            <GooglePlacesAutocomplete
                                                ref={pickupRef}
                                                placeholder="Pickup location"
                                                fetchDetails={true}
                                                onPress={handlePickupSelect}
                                                query={{
                                                    key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
                                                    language: 'en',
                                                }}
                                                enablePoweredByContainer={false}
                                                styles={{
                                                    container: { flex: 0, width: '100%' },
                                                    textInput: {
                                                        backgroundColor: 'transparent',
                                                        height: 50,
                                                        fontSize: 16,
                                                        fontWeight: '600',
                                                        color: isDark ? 'white' : 'black',
                                                        paddingHorizontal: 12,
                                                    },
                                                    listView: {
                                                        maxHeight: 200,
                                                        backgroundColor: isDark ? '#1C1C1E' : 'white',
                                                        borderBottomWidth: 1,
                                                        borderColor: isDark ? '#3A3A3C' : '#E5E5E7',
                                                    },
                                                    row: { padding: 12, backgroundColor: isDark ? '#1C1C1E' : 'white' },
                                                    description: { color: isDark ? '#E5E5E7' : 'black' },
                                                }}
                                            />
                                        </View>

                                        {/* Destination Location Autocomplete */}
                                        <View className="flex-row items-center bg-muted/20 z-[900]">
                                            <GooglePlacesAutocomplete
                                                ref={destinationRef}
                                                placeholder="Where to?"
                                                fetchDetails={true}
                                                onPress={handleDestinationSelect}
                                                query={{
                                                    key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
                                                    language: 'en',
                                                }}
                                                enablePoweredByContainer={false}
                                                styles={{
                                                    container: { flex: 0, width: '100%' },
                                                    textInput: {
                                                        backgroundColor: 'transparent',
                                                        height: 50,
                                                        fontSize: 16,
                                                        fontWeight: '600',
                                                        color: isDark ? 'white' : 'black',
                                                        paddingHorizontal: 12,
                                                    },
                                                    listView: {
                                                        maxHeight: 200,
                                                        backgroundColor: isDark ? '#1C1C1E' : 'white',
                                                    },
                                                    row: { padding: 12, backgroundColor: isDark ? '#1C1C1E' : 'white' },
                                                    description: { color: isDark ? '#E5E5E7' : 'black' },
                                                }}
                                            />
                                        </View>
                                    </View>

                                    <View className="w-10 pt-2 ml-3">
                                        <TouchableOpacity className="w-10 h-10 bg-muted/30 rounded-full items-center justify-center">
                                            <Feather name="plus" size={20} color={isDark ? "white" : "black"} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Static Bottom Fallbacks (shown when not searching) */}
                                <View className="flex-1 -z-10 mt-12 px-4">
                                    <TouchableOpacity className="flex-row items-center py-4 border-b border-muted/20">
                                        <View className="w-10 items-center justify-center mr-3">
                                            <Feather name="globe" size={20} color={isDark ? "white" : "black"} />
                                        </View>
                                        <Text className="font-bold text-base text-foreground">Search in a different city</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity className="flex-row items-center py-4">
                                        <View className="w-10 items-center justify-center mr-3">
                                            <MaterialIcons name="location-pin" size={20} color={isDark ? "white" : "black"} />
                                        </View>
                                        <Text className="font-bold text-base text-foreground">Set location on map</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Animated.View>

                        {/* COMPACT STATE (Set your destination defaults) */}
                        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, compactStyle]} pointerEvents={sheetState === "COLLAPSED" ? "auto" : "none"}>
                            <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
                                <View className="items-center mb-6 mt-2">
                                    <Text className="text-xl font-extrabold text-foreground">Set your destination</Text>
                                    <Text className="text-sm text-muted-foreground mt-1">Drag map to move pin</Text>
                                </View>

                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        setSheetIndex(1);
                                    }}
                                    className="flex-row items-center bg-muted/40 h-14 rounded-2xl px-4 mb-4"
                                >
                                    <View className="w-2 h-2 bg-foreground mr-3" />
                                    <Text numberOfLines={1} className={`flex-1 text-base font-semibold mr-2 ${!destination ? 'text-muted-foreground' : 'text-foreground'}`}>
                                        {isUpdatingFromMap ? 'Updating location...' : (destination?.title || 'Where to?')}
                                    </Text>
                                    <Feather name="search" size={20} color={isDark ? "white" : "black"} />
                                </TouchableOpacity>

                                <TouchableOpacity className="bg-foreground h-14 rounded-xl items-center justify-center">
                                    <Text className="text-background font-bold text-lg">Search destination</Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </View>

                </View>
            </BottomSheet>
        </GestureHandlerRootView>
    );
}
