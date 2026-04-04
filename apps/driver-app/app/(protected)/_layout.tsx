import { useAuth, useUser } from '@clerk/expo';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { Stack, useSegments } from 'expo-router';

export default function ProtectedLayout() {
  const segments = useSegments()
  const { userId } = useAuth();
  const user = useQuery(api.routes.driver.getDriver, userId && userId !== '' ? { clerkId: userId } : 'skip');

  const protectedGuard = !!userId && !!user;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={protectedGuard && user?.driverDetails !== null}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="editProfile"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="createVehicle"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="editVehicle"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Protected>
      <Stack.Screen name="register" />
      <Stack.Screen name="registerAsDriver" />
    </Stack>
  );
}
