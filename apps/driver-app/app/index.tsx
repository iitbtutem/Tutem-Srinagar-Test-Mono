import { useAuth } from '@clerk/expo';
import { useConvexAuth } from 'convex/react';
import { Redirect } from 'expo-router';

export default function RootScreen() {
  console.log("i am in root screen");
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isSignedIn, isLoaded } = useAuth();

  if (isLoading || !isLoaded) return null

  if (isAuthenticated && isSignedIn) {
    return <Redirect href={'/(protected)'} />;
  }

  return <Redirect href={'/signin'} />;
}