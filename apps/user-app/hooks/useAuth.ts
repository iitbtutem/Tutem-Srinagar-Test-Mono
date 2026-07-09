import { AuthContext } from '@/context/AuthContext';
import { useContext } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@tutem/api';
import { ConvexError } from 'convex/values';

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
    if (sessionToken) {
      try {
        await deleteSessionMutation({ sessionToken });
      } catch {
        // Clear local state even if backend call fails
      }
    }
    await localSignOut();
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
