import { AuthContext } from '@/context/AuthContext';
import { useContext } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@tutem/api';
import { Id } from '@tutem/api';

export function useAuth() {
  const authState = useContext(AuthContext);
  if (!authState) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }

  const {
    sessionToken,
    userId,
    phoneNumber,
    isAuthenticated,
    isLoaded,
    signIn,
    signOut: localSignOut,
  } = authState;
  const deleteSessionMutation = useMutation(api.routes.auth.deleteSession);
  const logout = useMutation(api.routes.driver.logout);
  const signOut = async () => {
    if (sessionToken) {
      try {
        await deleteSessionMutation({ sessionToken });
        await logout({ sessionToken });
      } catch {
        // Even if backend call fails, clear local state so the user is signed out
      }
    }
    await localSignOut();
  };

  return {
    sessionToken,
    userId: userId as Id<'user'> | null,
    phoneNumber,
    isSignedIn: isAuthenticated,
    isLoaded,
    signIn,
    signOut,
  };
}
