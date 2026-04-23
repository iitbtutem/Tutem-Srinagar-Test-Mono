import '@/global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ClerkProvider, useAuth } from '@clerk/expo';
import * as SecureStore from 'expo-secure-store';
import { ToastProvider } from '@/components/CustomToast';
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { cn } from '@/lib/utils';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as Notifications from 'expo-notifications';
import { NotificationProvider } from '@/context/NotificationContext';

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
    } catch {
      return
    }
  },
};

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider
        publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
        tokenCache={tokenCache}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <NotificationProvider>
            <ToastProvider>
              <KeyboardProvider>
                <StatusBar
                  style={colorScheme === 'dark' ? 'light' : 'dark'}
                  backgroundColor={colorScheme === 'dark' ? '#000' : '#fff'}
                />
                <View className={cn("flex-1", colorScheme === 'dark' ? 'dark' : '')}>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                    }}
                  />
                  <PortalHost />
                </View>
              </KeyboardProvider>
            </ToastProvider>
          </NotificationProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
