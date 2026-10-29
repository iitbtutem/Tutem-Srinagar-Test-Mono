import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRider } from '@/hooks/useRider';
import { useNotification } from '@/context/NotificationContext';
import { useAuthenticatedMutation } from '@/hooks/customApi';
import { api } from '@tutem/api';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProtectedLayout() {
  const { sessionToken } = useAuth();
  const { rider } = useRider();
  const { expoPushToken } = useNotification();
  const registerExpoPushToken = useAuthenticatedMutation(api.routes.rider.registerExpoPushToken);
  const syncedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Check if device token exists and differs from token stored in DB
    if (
      sessionToken &&
      rider?.riderDetails?._id &&
      expoPushToken &&
      rider.riderDetails.expoPushToken !== expoPushToken &&
      syncedTokenRef.current !== expoPushToken
    ) {
      syncedTokenRef.current = expoPushToken;
      registerExpoPushToken({
        riderId: rider.riderDetails._id,
        expoPushToken,
      }).catch((err) => {
        console.error('Failed to update push token in DB:', err);
        syncedTokenRef.current = null;
      });
    }
  }, [
    sessionToken,
    rider?.riderDetails?._id,
    rider?.riderDetails?.expoPushToken,
    expoPushToken,
  ]);

  const protectedGuard = !!sessionToken && !!rider;

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-primary">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={protectedGuard && !!rider.riderDetails}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="editProfile" />
        </Stack.Protected>
        <Stack.Screen name="register" />
        <Stack.Protected guard={protectedGuard && rider.riderDetails === null}>
          <Stack.Screen name="registerAsRider" />
        </Stack.Protected>
      </Stack>
    </SafeAreaView>
  );
}
