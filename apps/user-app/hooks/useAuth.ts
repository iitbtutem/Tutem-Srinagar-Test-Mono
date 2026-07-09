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

  const deleteSessionMutation = useMutation(api.routes.auth.deleteSession);
  const signOut = async () => {
    const tokenToDelete = sessionToken;
    await localSignOut();
    router.replace('/signin');
    if (tokenToDelete) {
      deleteSessionMutation({ sessionToken: tokenToDelete }).catch(() => {});
    }
  };

  return {
    sessionToken,
    phoneNumber,
    isAuthenticated,
    isLoaded,
    signIn,
    signOut,
  };
}
