"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthenticatedQuery } from "@/hooks/customApi";
import { api } from "@tutem/api";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface AuthBoundaryProps {
  children: React.ReactNode;
  onAuthError: (error: Error) => void;
}

class AuthBoundary extends React.Component<
  AuthBoundaryProps,
  { hasError: boolean }
> {
  constructor(props: AuthBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onAuthError(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: "var(--color-background)" }}
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2
              className="h-8 w-8 animate-spin"
              style={{ color: "var(--color-primary)" }}
            />
            <p
              className="text-sm"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              Redirecting…
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AuthChecker({ children }: { children: React.ReactNode }) {
  // Trigger query; will throw error if unauthorized or session is expired/invalid
  const profile = useAuthenticatedQuery(api.routes.admin.getAdminProfile);

  // If loading, show loader
  if (profile === undefined) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2
            className="h-8 w-8 animate-spin"
            style={{ color: "var(--color-primary)" }}
          />
          <p
            className="text-sm"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Checking permissions…
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { sessionToken, isLoaded, signOut } = useAuth();

  const handleAuthError = (error: Error) => {
    console.error("Auth error caught in guard:", error.message);
    signOut();
    router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
  };

  useEffect(() => {
    if (!isLoaded) return;

    if (!sessionToken) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoaded, sessionToken, pathname, router]);

  // While hydrating cookie, show loading
  if (!isLoaded) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2
            className="h-8 w-8 animate-spin"
            style={{ color: "var(--color-primary)" }}
          />
          <p
            className="text-sm"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (!sessionToken) return null;

  return (
    <AuthBoundary onAuthError={handleAuthError}>
      <AuthChecker>{children}</AuthChecker>
    </AuthBoundary>
  );
}
