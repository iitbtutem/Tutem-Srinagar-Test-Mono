import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Keyboard, ActivityIndicator, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView from 'react-native-maps';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

export default function WhereTo() {
    const insets = useSafeAreaInsets();
    const bottomSheetRef = useRef<BottomSheet>(null);
    const mapRef = useRef<MapView>(null);


    // Dynamic UI States
    const [pickupLocation, setPickupLocation] = useState('Current Location');
    const [destination, setDestination] = useState('');
    const [sheetState, setSheetState] = useState<"FULL" | "COLLAPSED">("FULL");

    console.log("sheet state is", sheetState);
    // Map Region State
    const [mapRegion, setMapRegion] = useState({
        latitude: 34.0837,
        longitude: 74.7973,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    });
    const [locationLoading, setLocationLoading] = useState(true);


    const handleSheetChanges = useCallback((value: "FULL" | "COLLAPSED") => {
        setSheetState(value);
        if (value === "COLLAPSED") Keyboard.dismiss(); // Dismiss keyboard when collapsing
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
            setSheetState("COLLAPSED");
            bottomSheetRef.current?.snapToIndex(0);
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
                        <ActivityIndicator size="large" color="black" className="-mt-8" />
                    ) : (
                        <View className="items-center justify-center -mt-8">
                            <View className="w-8 h-8 bg-black rounded-full items-center justify-center border-4 border-white shadow-sm">
                                <View className="w-2 h-2 bg-white rounded-full" />
                            </View>
                            <View className="w-1 h-4 bg-black" />
                            <View className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white opacity-80 -mt-2" />
                        </View>
                    )}
                </View>

                {/* Floating Back Button on Map Layer (visible when sheet is compact) */}
                {sheetState === "COLLAPSED" && (
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="absolute w-12 h-12 bg-white rounded-full items-center justify-center shadow-md shadow-black/20"
                        style={{ top: insets.top + 10, left: 16 }}
                    >
                        <Ionicons name="arrow-back" size={24} color="black" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Draggable Bottom Sheet Layer */}
            <BottomSheet
                ref={bottomSheetRef}
                index={1} // The sheet is fully open by default at 100%
                snapPoints={['40%', '90%']}
                onChange={(value) => handleSheetChanges(value === 1 ? "FULL" : "COLLAPSED")}
                backgroundStyle={{ borderRadius: sheetState === "FULL" ? 0 : 32 }}
                handleIndicatorStyle={{ backgroundColor: 'gray', width: 48, height: 4 }}
                keyboardBehavior="extend"
            >
                {sheetState === "FULL" ? (
                    /* EXPANDED FULL-SCREEN STATE (Plan your ride) */
                    <BottomSheetView style={{ flex: 1, paddingBottom: insets.bottom, paddingTop: insets.top + 16 }}>
                        {/* Header */}
                        <View className="flex-row items-center px-4 py-2">
                            <TouchableOpacity onPress={() => {
                                setSheetState("COLLAPSED");
                                Keyboard.dismiss();
                                bottomSheetRef.current?.snapToIndex(0);
                            }} className="p-2">
                                <Ionicons name="arrow-back" size={24} color="black" />
                            </TouchableOpacity>
                            <Text className="flex-1 text-center text-lg font-bold mr-8">Plan your ride</Text>
                        </View>

                        {/* Dropdowns */}
                        <View className="flex-row px-4 mt-2 gap-2">
                            <TouchableOpacity className="flex-row items-center bg-muted/40 px-3 py-2 rounded-full gap-2">
                                <Feather name="clock" size={16} color="black" />
                                <Text className="font-semibold text-sm">Pickup now</Text>
                                <Feather name="chevron-down" size={16} color="black" />
                            </TouchableOpacity>
                            <TouchableOpacity className="flex-row items-center bg-muted/40 px-3 py-2 rounded-full gap-2">
                                <MaterialIcons name="person" size={16} color="black" />
                                <Text className="font-semibold text-sm">For me</Text>
                                <Feather name="chevron-down" size={16} color="black" />
                            </TouchableOpacity>
                        </View>

                        {/* Active Search Inputs Block using Google Places */}
                        <View className="flex-row px-4 mt-6 z-50">
                            <View className="items-center mr-3 w-4 pt-4">
                                <View className="w-2 h-2 rounded-full bg-black" />
                                <View className="w-0.5 h-10 bg-black" />
                                <View className="w-2 h-2 bg-black" />
                            </View>

                            <View className="flex-1 border-2 border-black rounded-xl bg-white relative">
                                {/* Pickup Location */}
                                <View className="flex-row items-center px-3 py-3 border-b-2 border-muted/50">
                                    <TextInput
                                        placeholder="Pickup location"
                                        value={pickupLocation}
                                        onChangeText={setPickupLocation}
                                        className="flex-1 font-semibold text-base"
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
                                            },
                                            listView: {
                                                position: 'absolute',
                                                top: 50,
                                                left: -40, // Offsets the left timeline margin to look like full-width overlay
                                                width: '125%', // Expands to cover full screen width under inputs
                                                backgroundColor: 'white',
                                                zIndex: 9999,
                                                elevation: 10,
                                                borderBottomLeftRadius: 16,
                                                borderBottomRightRadius: 16,
                                            },
                                            row: {
                                                padding: 16,
                                                height: 60,
                                                flexDirection: 'row',
                                            },
                                            description: {
                                                fontSize: 15,
                                                fontWeight: '600',
                                            }
                                        }}
                                    />
                                </View>
                            </View>

                            <View className="w-10 pt-2 ml-3">
                                <TouchableOpacity className="w-10 h-10 bg-muted/30 rounded-full items-center justify-center">
                                    <Feather name="plus" size={20} color="black" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Static Bottom Fallbacks (shown when not searching) */}
                        <View className="flex-1 -z-10 mt-12 px-4">
                            <TouchableOpacity className="flex-row items-center py-4 border-b border-muted/20">
                                <View className="w-10 items-center justify-center mr-3">
                                    <Feather name="globe" size={20} color="black" />
                                </View>
                                <Text className="font-bold text-base">Search in a different city</Text>
                            </TouchableOpacity>

                            <TouchableOpacity className="flex-row items-center py-4">
                                <View className="w-10 items-center justify-center mr-3">
                                    <MaterialIcons name="location-pin" size={20} color="black" />
                                </View>
                                <Text className="font-bold text-base">Set location on map</Text>
                            </TouchableOpacity>
                        </View>
                    </BottomSheetView>
                ) : (
                    /* COMPACT STATE (Set your destination defaults) */
                    <BottomSheetView style={{ flex: 1, paddingHorizontal: 24, paddingBottom: insets.bottom + 16 }}>
                        <View className="items-center mb-6 mt-2">
                            <Text className="text-xl font-extrabold text-black">Set your destination</Text>
                            <Text className="text-sm text-muted-foreground mt-1">Drag map to move pin</Text>
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                                setSheetState("FULL");
                                bottomSheetRef.current?.snapToIndex(1);
                            }}
                            className="flex-row items-center bg-muted/40 h-14 rounded-2xl px-4 mb-4"
                        >
                            <View className="w-2 h-2 bg-black mr-3" />
                            <Text className={`flex-1 text-base font-semibold mr-2 ${!destination && 'text-muted-foreground'}`}>
                                {destination || 'Where to?'}
                            </Text>
                            <Feather name="search" size={20} color="black" />
                        </TouchableOpacity>

                        <TouchableOpacity className="bg-black h-14 rounded-xl items-center justify-center">
                            <Text className="text-white font-bold text-lg">Search destination</Text>
                        </TouchableOpacity>
                    </BottomSheetView>
                )}
            </BottomSheet>
        </GestureHandlerRootView>
    );
}
