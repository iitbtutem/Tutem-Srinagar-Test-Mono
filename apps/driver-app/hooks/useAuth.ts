import { AuthContext } from '@/context/AuthContext';
import { useContext } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@tutem/api';
import { ConvexError } from 'convex/values';
import { router } from 'expo-router';

export function useAuth() {
  const authState = useContext(AuthContext);
  if (!authState) {
    throw new ConvexError('useAuth must be used inside <AuthProvider>');
  }

  const {
    sessionToken,
    phoneNumber,
    isAuthenticated,
    isLoaded,
    signIn,
    signOut: localSignOut,
  } = authState;
  const logout = useMutation(api.routes.driver.logout);
  const signOut = async () => {
    const tokenToDelete = sessionToken;
    await localSignOut();
    router.replace('/signin');
    if (tokenToDelete) {
      logout({ sessionToken: tokenToDelete }).catch(() => {});
    }
  };

  return {
    sessionToken,
    phoneNumber,
    isSignedIn: isAuthenticated,
    isLoaded,
    signIn,
    signOut,
  };
}
