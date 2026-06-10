import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { useConvexAuth } from 'convex/react';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export default function RootScreen() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isSignedIn, isLoaded } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const value = await SecureStore.getItemAsync('hasSeenOnboarding');
        setHasSeenOnboarding(value === 'true');
      } catch (e) {
        setHasSeenOnboarding(false);
      }
    }
    checkOnboarding();
  }, []);

  if (isLoading || !isLoaded || hasSeenOnboarding === null) return null;

  if (!hasSeenOnboarding) {
    return <Redirect href={'/onboarding'} />;
  }

  if (isAuthenticated && isSignedIn) {
    return <Redirect href={'/(protected)'} />;
  }

  return <Redirect href={'/signin'} />;
}