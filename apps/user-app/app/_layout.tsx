import '@/global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ConvexReactClient, ConvexProvider } from 'convex/react';
import { ToastProvider } from '@/components/CustomToast';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { NotificationProvider } from '@/context/NotificationContext';
import { AuthProvider } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { useInternet } from '@/hooks/useInternet';
import { View } from 'react-native';
import { Text } from '@tutem/ui';
import Offline from '@/components/offline';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { useLocation } from '@/hooks/useCurrentLocation';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  const [launchedOffline, setLaunchedOffline] = useState(false);

  const { isOnline, checked } = useInternet();
  const { refreshLocation } = useLocation();

  useEffect(() => {
    refreshLocation();
  }, []);

  useEffect(() => {
    if (checked) {
      setLaunchedOffline(!isOnline);
    }
  }, [checked]);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }, []);

  if (!checked) return null;

  if (launchedOffline && !isOnline) {
    return <Offline />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConvexProvider client={convex}>
        <AuthProvider>
          <NotificationProvider>
            <ToastProvider>
              <SafeAreaView edges={['top']} className="bg-primary" />
              <StatusBar style="light" translucent backgroundColor={colors.primary} />
              <Stack
                screenOptions={{
                  headerShown: false,
                }}
              />
              {!isOnline && (
                <View className="bg-red-500 py-2 px-3">
                  <Text className="text-white text-center text-sm font-medium">
                    You are offline
                  </Text>
                </View>
              )}
              <PortalHost />
            </ToastProvider>
          </NotificationProvider>
        </AuthProvider>
      </ConvexProvider>
    </GestureHandlerRootView>
  );
}
