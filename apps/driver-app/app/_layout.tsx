import '@/global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ClerkProvider, useAuth } from '@clerk/expo';
import * as SecureStore from 'expo-secure-store';
import { ToastProvider } from '@/components/CustomToast';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colorScheme } from 'nativewind';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

// Secure token cache for Clerk
const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {}
  },
};

export default function RootLayout() {
  const theme = colorScheme.get();

  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ToastProvider>
          <StatusBar
            style={theme === 'dark' ? 'light' : 'dark'}
            backgroundColor={theme === 'dark' ? '#000' : '#edeef0'}
          />
          <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
            <Stack
              screenOptions={{
                headerShown: false,
              }}
            />
          </SafeAreaView>
          <PortalHost />
        </ToastProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
