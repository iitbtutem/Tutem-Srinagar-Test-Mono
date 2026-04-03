import { useAuth, useUser } from '@clerk/expo';
import { api } from '@tutem/api';
import { useConvexAuth, useQuery } from 'convex/react';
import { Redirect, router, Stack } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useEffect } from 'react';

export default function ProtectedLayout() {
  const { userId } = useAuth();

  const user = useQuery(api.routes.rider.getRider, { clerkId: userId ?? '' });
  const protectedGuard = !!userId && !!user;

  useEffect(() => {
    if (user && user.rider === null && userId) {
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace('/register');
    }
    if (protectedGuard && user.rider === null) {
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace('/registerAsRider');
    }
  }, [user, userId, router]);

  if (user === undefined) return <ActivityIndicator />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={protectedGuard && !!user.rider}>
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
      <Stack.Protected guard={protectedGuard && user.rider === null}>
        <Stack.Screen name="registerAsRider" />
      </Stack.Protected>
    </Stack>
  );
}
