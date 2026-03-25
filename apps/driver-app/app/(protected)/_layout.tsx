import { useAuth } from '@clerk/expo';
import { api } from '@tutem/api';
import { useConvexAuth, useQuery } from 'convex/react';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator } from 'react-native';

export default function ProtectedLayout() {
  const { isAuthenticated } = useConvexAuth();
  const { isSignedIn, userId } = useAuth();

  const user = useQuery(api.routes.user.getUser, { clerkId: userId ?? '' });

  if (user === undefined) return <ActivityIndicator />;

  if (!isAuthenticated || !isSignedIn) return <Redirect href={'/(auth)/signin'} />;

  const protectedGuard = isAuthenticated && !!isSignedIn && !!userId && !!user;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={protectedGuard}>
        <Stack.Screen name="(tabs)/index" />
        <Stack.Screen name="vehicleRegistration" />
        <Stack.Screen
          name="editProfile"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Protected>
      <Stack.Screen name="register" />
    </Stack>
  );
}
