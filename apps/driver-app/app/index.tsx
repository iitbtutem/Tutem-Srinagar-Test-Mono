import LoadingScreen from '@/components/LoadingScreen';
import { useAuth } from '@clerk/expo';
import { useConvexAuth } from 'convex/react';
import { Redirect } from 'expo-router';

export default function RootScreen() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isSignedIn, isLoaded } = useAuth();

  if (isLoading || !isLoaded) return <LoadingScreen message='fetching driver' />

  if (isAuthenticated && isSignedIn) {
    return <Redirect href={'/(protected)'} />;
  }

  return <Redirect href={'/signin'} />;
}