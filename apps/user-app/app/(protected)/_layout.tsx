import { useAuth, useUser } from '@clerk/expo';
import { api } from '@tutem/api';
import { useConvexAuth, useQuery } from 'convex/react';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import ErrorScreen from '@/components/ErrorScreen';

export default function ProtectedLayout() {
  const { isAuthenticated } = useConvexAuth();
  const { isSignedIn, userId, signOut } = useAuth();
  const { user: clerkUser, isLoaded: isClerkUserLoaded } = useUser();

  const user = useQuery(api.routes.rider.getRider, { clerkId: userId ?? '' });

  if (user === undefined || !isClerkUserLoaded) return <ActivityIndicator />;

  if (!isAuthenticated || !isSignedIn) return <Redirect href={'/(auth)/signin'} />;

  const protectedGuard = isAuthenticated && !!isSignedIn && !!userId && !!user && !!user.rider;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={protectedGuard}>
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
    </Stack>
  );
}
