import { AuthContext } from '@/context/AuthContext';
import { useContext } from 'react';

export function useAuthUser() {
  const authState = useContext(AuthContext);
  if (!authState) {
    throw new Error('useAuthContext must be used inside <AuthProvider>');
  }

  const { userId, phoneNumber, isAuthenticated, isLoaded, signIn, signOut } = authState;

  return { userId, phoneNumber, isAuthenticated, isLoaded, signIn, signOut };
}
