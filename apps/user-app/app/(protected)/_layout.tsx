import { useAuth } from '@clerk/expo';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { Stack } from 'expo-router';
import { ActivityIndicator } from 'react-native';

export default function ProtectedLayout() {
  const { userId } = useAuth();

  const rider = useQuery(api.routes.rider.getRider, { clerkId: userId ?? '' });
  const protectedGuard = !!userId && !!rider;

  if (rider === undefined) return <ActivityIndicator />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={protectedGuard && !!rider.riderDetails}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="editProfile"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Protected>
      <Stack.Screen name="register" />
      <Stack.Protected guard={protectedGuard && rider.riderDetails === null}>
        <Stack.Screen name="registerAsRider" />
      </Stack.Protected>
    </Stack>
  );
}
