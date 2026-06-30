import React, { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

const KEY_SESSION_TOKEN = 'auth_sessionToken';
const KEY_USER_ID = 'auth_userId';
const KEY_PHONE = 'auth_phoneNumber';

interface AuthState {
  sessionToken: string | null;
  userId: string | null;
  phoneNumber: string | null;
  isLoaded: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (sessionToken: string, userId: string, phoneNumber: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function restoreSession() {
      try {
        const [storedToken, storedUserId, storedPhone] = await Promise.all([
          SecureStore.getItemAsync(KEY_SESSION_TOKEN),
          SecureStore.getItemAsync(KEY_USER_ID),
          SecureStore.getItemAsync(KEY_PHONE),
        ]);
        if (storedToken && storedUserId && storedPhone) {
          setSessionToken(storedToken);
          setUserId(storedUserId);
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

  const signIn = useCallback(async (token: string, id: string, phone: string) => {
    await Promise.all([
      SecureStore.setItemAsync(KEY_SESSION_TOKEN, token),
      SecureStore.setItemAsync(KEY_USER_ID, id),
      SecureStore.setItemAsync(KEY_PHONE, phone),
    ]);
    setSessionToken(token);
    setUserId(id);
    setPhoneNumber(phone);
  }, []);

  /** Clears local state only. Pair with the backend `logout` mutation call in useAuth. */
  const signOut = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEY_SESSION_TOKEN),
      SecureStore.deleteItemAsync(KEY_USER_ID),
      SecureStore.deleteItemAsync(KEY_PHONE),
    ]);
    setSessionToken(null);
    setUserId(null);
    setPhoneNumber(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        sessionToken,
        userId,
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
