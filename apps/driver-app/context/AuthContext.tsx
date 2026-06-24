import React, {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY_USER_ID = 'auth_userId';
const STORAGE_KEY_PHONE = 'auth_phoneNumber';

interface AuthState {
  userId: string | null;
  phoneNumber: string | null;
  isLoaded: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (userId: string, phoneNumber: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function restoreSession() {
      try {
        const [storedUserId, storedPhone] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_KEY_USER_ID),
          SecureStore.getItemAsync(STORAGE_KEY_PHONE),
        ]);
        if (storedUserId && storedPhone) {
          setUserId(storedUserId);
          setPhoneNumber(storedPhone);
        }
      } catch {
      } finally {
        setIsLoaded(true);
      }
    }
    restoreSession();
  }, []);

  const signIn = useCallback(async (id: string, phone: string) => {
    await Promise.all([
      SecureStore.setItemAsync(STORAGE_KEY_USER_ID, id),
      SecureStore.setItemAsync(STORAGE_KEY_PHONE, phone),
    ]);
    setUserId(id);
    setPhoneNumber(phone);
  }, []);

  const signOut = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEY_USER_ID),
      SecureStore.deleteItemAsync(STORAGE_KEY_PHONE),
    ]);
    setUserId(null);
    setPhoneNumber(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        userId,
        phoneNumber,
        isLoaded,
        isAuthenticated: !!userId,
        signIn,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}
