import React, { useState, useEffect } from 'react';
import { View, Alert } from 'react-native';
import { Text } from '@/components/ui/text';
import { Switch } from '@/components/ui/switch';
import { startLocationTracking, stopLocationTracking } from '@/lib/locationService';
import * as SecureStore from 'expo-secure-store';
import { MapPin, Navigation } from 'lucide-react-native';
import * as Location from 'expo-location';
import { BACKGROUND_LOCATION_TASK } from '@/lib/tasks';
import { useAuth } from '@clerk/expo';
import { useQuery } from 'convex/react';
import { api } from '@tutem/api';

export function DriverScreen() {
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { userId, getToken } = useAuth();
  const driver = useQuery(
    api.routes.driver.getUser,
    userId ? { clerkId: userId } : 'skip'
  );

  const driverId = driver?.driverDetails?._id;

  useEffect(() => {
    // Check if tracking is already active when component mounts
    const checkStatus = async () => {
      try {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        setIsOnline(hasStarted);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    checkStatus();
  }, []);

  const handleToggleOnline = async (checked: boolean) => {
    if (checked) {
      if (!driverId) {
        Alert.alert('Not Ready', 'Driver profile is not loaded yet. Please try again.');
        return;
      }

      // Fetch the Clerk session token and persist everything the background task needs.
      // The background task runs in a separate headless thread with NO access to
      // React context, hooks, or process.env — SecureStore is the only bridge.
      const authToken = await getToken();
      if (!authToken) {
        Alert.alert('Auth Error', 'Could not retrieve session token. Please log in again.');
        return;
      }

      await SecureStore.setItemAsync('driverId', driverId);
      await SecureStore.setItemAsync('authToken', authToken);

      const success = await startLocationTracking();
      if (success) {
        setIsOnline(true);
      } else {
        Alert.alert(
          'Permission Error',
          'Could not start tracking. Please grant "Allow all the time" location permission in your phone settings.'
        );
        setIsOnline(false);
      }
    } else {
      await stopLocationTracking();
      setIsOnline(false);
    }
  };

  return (
    <View className="flex-1 bg-background p-6 justify-center items-center">
      <View className="items-center bg-card p-8 rounded-3xl shadow-sm border border-border w-full max-w-sm">
        <View className={`p-4 rounded-full mb-6 ${isOnline ? 'bg-primary/20' : 'bg-muted'}`}>
          {isOnline ? (
            <Navigation size={40} className="text-primary" />
          ) : (
            <MapPin size={40} className="text-muted-foreground" />
          )}
        </View>

        <Text className="text-2xl font-bold mb-2">
          {isOnline ? "You're Online" : "You're Offline"}
        </Text>

        <Text className="text-muted-foreground text-center mb-8">
          {isOnline
            ? 'Your location is being shared. You can now receive ride requests.'
            : 'Go online to start receiving ride requests from nearby passengers.'}
        </Text>

        <View className="flex-row items-center justify-between w-full p-4 bg-muted/50 rounded-2xl">
          <Text className="text-lg font-medium">Driver Status</Text>
          <Switch
            checked={isOnline}
            onCheckedChange={handleToggleOnline}
            disabled={isLoading || !driverId}
          />
        </View>

        {!driverId && !isLoading && (
          <Text className="text-destructive text-sm mt-3 text-center">
            Driver profile not found. Cannot start tracking.
          </Text>
        )}
      </View>
    </View>
  );
}
