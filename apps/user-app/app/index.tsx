import { useEffect, useState } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export default function RootScreen() {
  const { isAuthenticated, isLoaded } = useAuthUser();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const value = await SecureStore.getItemAsync('hasSeenOnboarding');
        setHasSeenOnboarding(value === 'true');
      } catch {
        setHasSeenOnboarding(false);
      }
    }
    checkOnboarding();
  }, []);

  if (!isLoaded || hasSeenOnboarding === null) return null;

  if (!hasSeenOnboarding) {
    return <Redirect href={'/onboarding'} />;
  }

  if (isAuthenticated) {
    return <Redirect href={'/(protected)'} />;
  }

  return <Redirect href={'/signin'} />;
}
