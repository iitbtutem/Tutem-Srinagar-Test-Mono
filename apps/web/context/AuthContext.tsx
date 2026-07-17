"use client";

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

const SESSION_KEY = "tutem_admin_session";

interface AuthContextValue {
  sessionToken: string | null;
  isLoaded: boolean;
  signIn: (token: string) => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  sessionToken: null,
  isLoaded: false,
  signIn: () => {},
  signOut: () => {},
});

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() ?? null;
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Hydrate from cookie on mount (client-only)
  useEffect(() => {
    try {
      const stored = getCookie(SESSION_KEY);
      setSessionToken(stored);
    } catch {
      setSessionToken(null);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const signIn = useCallback((token: string) => {
    try {
      document.cookie = `${SESSION_KEY}=${token}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
    setSessionToken(token);
  }, []);

  const signOut = useCallback(() => {
    try {
      document.cookie = `${SESSION_KEY}=; path=/; max-age=0; SameSite=Lax`;
    } catch {}
    setSessionToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ sessionToken, isLoaded, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
