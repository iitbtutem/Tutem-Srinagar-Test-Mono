import { useAuth } from '@clerk/expo';
import { useConvexAuth } from 'convex/react';
import { Redirect } from 'expo-router';

export default function RootScreen() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isSignedIn, isLoaded } = useAuth();

  if (isLoading || !isLoaded) return null

  if (isAuthenticated && isSignedIn) {
    return <Redirect href={'/(protected)/(tabs)'} />;
  }

  return <Redirect href={'/(auth)/signin'} />;
}