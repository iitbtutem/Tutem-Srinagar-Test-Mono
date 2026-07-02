import { AuthContext } from '@/context/AuthContext';
import { useContext } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@tutem/api';

export function useAuthUser() {
  const authState = useContext(AuthContext);
  if (!authState) {
    throw new Error('useAuthUser must be used inside <AuthProvider>');
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
