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

  const user = useQuery(api.routes.user.getUser, { clerkId: userId ?? '' });

  if (user === undefined || !isClerkUserLoaded) return <ActivityIndicator />;

  if (!isAuthenticated || !isSignedIn) return <Redirect href={'/(auth)/signin'} />;

  // Sync role to Clerk metadata if missing (for legacy or cross-app users)
  if (user && !clerkUser?.unsafeMetadata?.role) {
    clerkUser?.update({
      unsafeMetadata: { role: user.type.toLowerCase() },
    });
  }

  // Role check: If a driver tries to use the rider app
  if (clerkUser?.unsafeMetadata?.role === 'driver' || user?.type === 'Driver') {
    return (
      <ErrorScreen
        message="Access Denied: Driver account detected. This application is exclusively for riders. Please use the Tutem Driver app to manage your rides, or log out to sign in with a rider account."
        actionText="Logout"
        onAction={async () => {
          await signOut();
        }}
      />
    );
  }

  const protectedGuard = isAuthenticated && !!isSignedIn && !!userId && !!user;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={protectedGuard}>
        <Stack.Screen name="(tabs)/index" />
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
