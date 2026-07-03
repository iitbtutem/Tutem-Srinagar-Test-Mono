import React, { Component, type ReactNode } from 'react';
import { ConvexError } from 'convex/values';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

interface ErrorBoundaryProps {
  children: ReactNode;
  onSessionError: () => Promise<void>;
}

interface ErrorBoundaryState {
  error: any | null;
}

class QueryErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: any) {
    return { error };
  }

  componentDidCatch(error: any, errorInfo: React.ErrorInfo) {
    const isAuthError =
      (error instanceof ConvexError &&
        (error.data === 'Invalid or expired session' ||
         error.data === 'User not found')) ||
      (error instanceof Error &&
        (error.message.includes('Invalid or expired session') ||
         error.message.includes('User not found')));

    if (isAuthError) {
      console.warn('Caught auth/session error in AuthErrorBoundary. Resetting auth state...', error);
      this.props.onSessionError()
        .catch((err) => console.error('Failed to sign out on session error:', err))
        .finally(() => {
          this.setState({ error: null });
          router.replace('/signin');
        });
    }
  }

  render() {
    const { error } = this.state;
    if (error) {
      const isAuthError =
        (error instanceof ConvexError &&
          (error.data === 'Invalid or expired session' ||
           error.data === 'User not found')) ||
        (error instanceof Error &&
          (error.message.includes('Invalid or expired session') ||
           error.message.includes('User not found')));

      if (isAuthError) {
        // Return null/empty view while the redirection is in progress
        return null;
      }
      // Rethrow unrelated errors so they bubble up to Expo Router or other boundaries
      throw error;
    }
    return this.props.children;
  }
}

export default function AuthErrorBoundary({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();

  return (
    <QueryErrorBoundary onSessionError={signOut}>
      {children}
    </QueryErrorBoundary>
  );
}
