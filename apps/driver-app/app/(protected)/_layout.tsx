import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDriver } from '@/hooks/useDriver';
import { useNotification } from '@/context/NotificationContext';
import { useAuthenticatedMutation, useAuthenticatedQuery } from '@/hooks/customApi';
import { api } from '@tutem/api';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocationManager } from '@/hooks/useLocationManager';
import { stopLocationTracking } from '@/lib/locationService';

export default function ProtectedLayout() {
  const { sessionToken, isLoaded: isAuthLoaded } = useAuth();
  const { driver } = useDriver();
  const { expoPushToken } = useNotification();
  const registerExpoPushToken = useAuthenticatedMutation(api.routes.driver.registerExpoPushToken);
  const currentRide = useAuthenticatedQuery(
    api.routes.rides.getDriverCurrentRideByDriverId,
    driver?.driverDetails ? { driverId: driver.driverDetails._id } : 'skip'
  );

  // Keep location lifecycle above individual screens/tabs so direct ride links
  // and navigation away from Home cannot prevent native tracking registration.
  useLocationManager({
    driverId: driver?.driverDetails?._id,
    userId: driver?._id,
    isOnline: driver?.driverDetails?.isOnline,
    isAvailableForRide: driver?.driverDetails?.isAvailableForRide,
    isLicenseVerified: driver?.driverDetails?.isLicenseVerified,
    hasActiveRide: !!currentRide,
    stateResolved: driver !== undefined && currentRide !== undefined,
  });

  useEffect(() => {
    const driverRecordMissing = driver !== undefined && (!driver || !driver.driverDetails);
    if (isAuthLoaded && (!sessionToken || driverRecordMissing)) {
      void stopLocationTracking();
    }
  }, [driver, isAuthLoaded, sessionToken]);

  const syncedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Check if device token exists and differs from token stored in DB
    if (
      sessionToken &&
      driver?.driverDetails?._id &&
      expoPushToken &&
      driver.driverDetails.expoPushToken !== expoPushToken &&
      syncedTokenRef.current !== expoPushToken
    ) {
      syncedTokenRef.current = expoPushToken;
      registerExpoPushToken({
        driverId: driver.driverDetails._id,
        expoPushToken,
      }).catch((err) => {
        console.error('Failed to update push token in DB:', err);
        syncedTokenRef.current = null;
      });
    }
  }, [
    sessionToken,
    driver?.driverDetails?._id,
    driver?.driverDetails?.expoPushToken,
    expoPushToken,
  ]);

  const protectedGuard = !!sessionToken && !!driver;

  return (
    <SafeAreaView edges={['bottom']} className="flex-1">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={protectedGuard && driver?.driverDetails !== null}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="editProfile" />
          <Stack.Screen
            name="createVehicle"
            options={{
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="editVehicle"
            options={{
              animation: 'fade',
            }}
          />
        </Stack.Protected>
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
        <Stack.Screen name="registerAsDriver" />
      </Stack>
    </SafeAreaView>
  );
}
