import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Keyboard, ActivityIndicator, Platform } from 'react-native';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView from 'react-native-maps';
import BottomSheet from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Location from 'expo-location';
import { colorScheme, useColorScheme } from 'nativewind';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

export default function WhereTo() {
    const { colorScheme: currentTheme } = useColorScheme();
    const isDark = currentTheme === 'dark';
    const insets = useSafeAreaInsets();
    const bottomSheetRef = useRef<BottomSheet>(null);
    const mapRef = useRef<MapView>(null);


    // Dynamic UI States
    const [pickupLocation, setPickupLocation] = useState('Current Location');
    const [destination, setDestination] = useState('');
    const [sheetIndex, setSheetIndex] = useState(1);
    const sheetState = sheetIndex >= 1 ? "FULL" : "COLLAPSED";
    const snapPoints = useMemo(() => ['40%', '90%'], []);

    console.log("sheet index is", sheetIndex, "state is", sheetState);
    // Map Region State
    const [mapRegion, setMapRegion] = useState({
        latitude: 34.0837,
        longitude: 74.7973,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    });
    const [locationLoading, setLocationLoading] = useState(true);


    const handleSheetChanges = useCallback((index: number) => {
        setSheetIndex(index);
        if (index === 0) Keyboard.dismiss(); // Dismiss keyboard when collapsing
    }, []);

    // Fetch Current User Location on mount
    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setPickupLocation('Location permissions denied');
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

            setMapRegion(newRegion);
            mapRef.current?.animateToRegion(newRegion, 1000);

            // Attempt reverse geocoding to update the placeholder
            try {
                let [address] = await Location.reverseGeocodeAsync({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                });
                if (address) {
                    setPickupLocation(`${address.street || address.name}, ${address.city}`);
                }
            } catch (e) { }

            setLocationLoading(false);
        })();
    }, []);

    const handlePlaceSelect = (data: any, details: any = null) => {
        setDestination(data.description);
        if (details?.geometry?.location) {
            const selectedRegion = {
                latitude: details.geometry.location.lat,
                longitude: details.geometry.location.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };
            setMapRegion(selectedRegion);
            mapRef.current?.animateToRegion(selectedRegion, 1000);

            // Collapse bottom sheet to strictly view the map and selected destination
            setSheetIndex(0);
            Keyboard.dismiss();
        }
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>

            {/* Map Background */}
            <View className="flex-1 relative bg-background">
                <MapView
                    ref={mapRef}
                    style={{ flex: 1 }}
                    region={mapRegion}
                    showsUserLocation={true}
                />

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
                snapPoints={snapPoints}
                onChange={handleSheetChanges}
                enableDynamicSizing={false}
                enablePanDownToClose={false}
                backgroundStyle={{ 
                    backgroundColor: isDark ? '#1C1C1E' : 'white',
                    borderRadius: sheetState === "FULL" ? 0 : 32 
                }}
                handleIndicatorStyle={{ backgroundColor: isDark ? '#3A3A3C' : '#D1D1D6', width: 48, height: 4 }}
                keyboardBehavior='extend'
            >
                <View style={{ flex: 1, paddingBottom: insets.bottom }}>

                    {sheetState === "FULL" ? (
                        /* EXPANDED FULL-SCREEN STATE (Plan your ride) */

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
                                </View>

                                <View className="flex-1 border-2 border-foreground/20 rounded-xl bg-background relative">
                                    {/* Pickup Location */}
                                    <View className="flex-row items-center px-3 py-3 border-b-2 border-muted/50">
                                        <TextInput
                                            placeholder="Pickup location"
                                            placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
                                            value={pickupLocation}
                                            onChangeText={setPickupLocation}
                                            className="flex-1 font-semibold text-base text-foreground"
                                        />
                                    </View>

                                    {/* Destination Location (GooglePlacesAutocomplete) */}
                                    <View className="flex-row items-center bg-muted/20 pb-0.5">
                                        <GooglePlacesAutocomplete
                                            placeholder="Where to?"
                                            fetchDetails={true}
                                            onPress={handlePlaceSelect}
                                            query={{
                                                key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '', // Insert your Google Maps API key in .env
                                                language: 'en',
                                            }}
                                            enablePoweredByContainer={false}
                                            styles={{
                                                container: { flex: 1 },
                                                textInputContainer: { backgroundColor: 'transparent', paddingHorizontal: 12 },
                                                textInput: {
                                                    backgroundColor: 'transparent',
                                                    height: 48,
                                                    fontSize: 16,
                                                    fontWeight: '600',
                                                    margin: 0,
                                                    padding: 0,
                                                    color: isDark ? 'white' : 'black',
                                                },
                                                listView: {
                                                    position: 'absolute',
                                                    top: 50,
                                                    left: -40, // Offsets the left timeline margin to look like full-width overlay
                                                    width: '125%', // Expands to cover full screen width under inputs
                                                    backgroundColor: isDark ? '#1C1C1E' : 'white',
                                                    zIndex: 9999,
                                                    elevation: 10,
                                                    borderBottomLeftRadius: 16,
                                                    borderBottomRightRadius: 16,
                                                },
                                                row: {
                                                    padding: 16,
                                                    height: 60,
                                                    flexDirection: 'row',
                                                    backgroundColor: isDark ? '#1C1C1E' : 'white',
                                                },
                                                description: {
                                                    fontSize: 15,
                                                    fontWeight: '600',
                                                    color: isDark ? '#E5E5E7' : 'black',
                                                },
                                                predefinedPlacesDescription: {
                                                    color: '#1faadb',
                                                },
                                                separator: {
                                                    backgroundColor: isDark ? '#3A3A3C' : '#E5E5E7',
                                                }
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
                    ) : (
                        /* COMPACT STATE (Set your destination defaults) */
                        <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: insets.bottom + 16 }}>
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
                                <Text className={`flex-1 text-base font-semibold mr-2 ${!destination ? 'text-muted-foreground' : 'text-foreground'}`}>
                                    {destination || 'Where to?'}
                                </Text>
                                <Feather name="search" size={20} color={isDark ? "white" : "black"} />
                            </TouchableOpacity>

                            <TouchableOpacity className="bg-foreground h-14 rounded-xl items-center justify-center">
                                <Text className="text-background font-bold text-lg">Search destination</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </BottomSheet>
        </GestureHandlerRootView>
    );
}
