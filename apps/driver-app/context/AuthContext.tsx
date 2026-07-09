import React, { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

const KEY_SESSION_TOKEN = 'auth_sessionToken';
const KEY_PHONE = 'auth_phoneNumber';

interface AuthState {
  sessionToken: string | null;
  phoneNumber: string | null;
  isLoaded: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (sessionToken: string, phoneNumber: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function restoreSession() {
      try {
        const [storedToken, storedPhone] = await Promise.all([
          SecureStore.getItemAsync(KEY_SESSION_TOKEN),
          SecureStore.getItemAsync(KEY_PHONE),
        ]);
        if (storedToken && storedPhone) {
          setSessionToken(storedToken);
          setPhoneNumber(storedPhone);
        }
      } catch {
        // ignore — stay unauthenticated
      } finally {
        setIsLoaded(true);
      }
    }
    restoreSession();
  }, []);

  const signIn = useCallback(async (token: string, phoneNumber: string) => {
    await Promise.all([
      SecureStore.setItemAsync(KEY_SESSION_TOKEN, token),
      SecureStore.setItemAsync(KEY_PHONE, phoneNumber),
    ]);
    setSessionToken(token);
    setPhoneNumber(phoneNumber);
  }, []);

  /** Clears local state only. Pair with the backend `logout` mutation call in useAuth. */
  const signOut = useCallback(async () => {
    setSessionToken(null);
    setPhoneNumber(null);
    await Promise.all([
      SecureStore.deleteItemAsync(KEY_SESSION_TOKEN),
      SecureStore.deleteItemAsync(KEY_PHONE),
    ]);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        sessionToken,
        phoneNumber,
        isLoaded,
        isAuthenticated: !!sessionToken,
        signIn,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}
