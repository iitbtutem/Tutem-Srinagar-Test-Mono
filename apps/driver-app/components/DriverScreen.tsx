import React, { useState, useEffect } from 'react';
import { View, Alert } from 'react-native';
import { Text, Switch } from '@tutem/ui';
import {
  startLocationTracking,
  stopLocationTracking,
  isLocationTrackingRunning,
} from '@/lib/locationService';
import * as SecureStore from 'expo-secure-store';
import { MapPin, Navigation } from 'lucide-react-native';
import { useDriver } from '@/hooks/useDriver';

export function DriverScreen() {
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { driver } = useDriver();

  const driverId = driver?.driverDetails?._id;

  useEffect(() => {
    // Check if tracking is already active when component mounts
    const checkStatus = async () => {
      try {
        const hasStarted = await isLocationTrackingRunning();
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

      await SecureStore.setItemAsync('driverId', driverId);

      const success = await startLocationTracking(driverId);
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
    <View className="flex-1 items-center justify-center bg-background p-6">
      <View className="w-full max-w-sm items-center rounded-3xl border border-border bg-card p-8 shadow-sm">
        <View className={`mb-6 rounded-full p-4 ${isOnline ? 'bg-primary/20' : 'bg-muted'}`}>
          {isOnline ? (
            <Navigation size={40} className="text-primary" />
          ) : (
            <MapPin size={40} className="text-muted-foreground" />
          )}
        </View>

        <Text className="mb-2 text-2xl font-bold">
          {isOnline ? "You're Online" : "You're Offline"}
        </Text>

        <Text className="mb-8 text-center text-muted-foreground">
          {isOnline
            ? 'Your location is being shared. You can now receive ride requests.'
            : 'Go online to start receiving ride requests from nearby passengers.'}
        </Text>

        <View className="w-full flex-row items-center justify-between rounded-2xl bg-muted/50 p-4">
          <Text className="text-lg font-medium">Driver Status</Text>
          <Switch
            checked={isOnline}
            onCheckedChange={handleToggleOnline}
            disabled={isLoading || !driverId}
          />
        </View>

        {!driverId && !isLoading && (
          <Text className="mt-3 text-center text-sm text-destructive">
            Driver profile not found. Cannot start tracking.
          </Text>
        )}
      </View>
    </View>
  );
}
