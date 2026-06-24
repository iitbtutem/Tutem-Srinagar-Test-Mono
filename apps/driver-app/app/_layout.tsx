import '@/global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ConvexReactClient, ConvexProvider } from 'convex/react';
import { AuthProvider } from '@/context/AuthContext';
import * as SecureStore from 'expo-secure-store';
import { ToastProvider } from '@/components/CustomToast';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as Notifications from 'expo-notifications';
import { NotificationProvider } from '@/context/NotificationContext';
import Offline from '@/components/offline';
import { useInternet } from '@/hooks/useInternet';
import { useEffect, useState } from 'react';
import { Text } from '@tutem/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';

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

  useEffect(() => {
    if (checked) {
      setLaunchedOffline(!isOnline);
    }
  }, [checked, isOnline]);

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
              <KeyboardProvider>
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
              </KeyboardProvider>
            </ToastProvider>
          </NotificationProvider>
        </AuthProvider>
      </ConvexProvider>
    </GestureHandlerRootView>
  );
}
