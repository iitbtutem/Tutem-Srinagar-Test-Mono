import { AuthContext } from '@/context/AuthContext';
import { useContext } from 'react';

export function useAuth() {
  const authState = useContext(AuthContext);
  if (!authState) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }

  const { userId, phoneNumber, isAuthenticated, isLoaded, signIn, signOut } = authState;

  return {
    userId,
    phoneNumber,
    isSignedIn: isAuthenticated,
    isLoaded,
    getToken: async () => userId || null,
    signOut,
    signIn,
  };
}
