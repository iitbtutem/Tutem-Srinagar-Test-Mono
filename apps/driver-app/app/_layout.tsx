import '@/global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ConvexReactClient, ConvexProvider } from 'convex/react';
import { AuthProvider } from '@/context/AuthContext';
import AuthErrorBoundary from '@/components/AuthErrorBoundary';
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
import { useSetAtom } from 'jotai';
import { locationAtom, getCurrentLocation } from '@/lib/location';
import * as Location from 'expo-location';

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
  const setLocation = useSetAtom(locationAtom);

  useEffect(() => {
    if (!checked) return;

    const requestLocationPermission = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const { status: askStatus } = await Location.requestForegroundPermissionsAsync();
          if (askStatus !== 'granted') {
            console.warn('Location permission not granted on launch');
            return;
          }
        }
        const loc = await getCurrentLocation();
        setLocation(loc);
      } catch (err) {
        console.warn('Failed to fetch location on launch:', err);
      }
    };

    requestLocationPermission();
  }, [checked]);

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
          <AuthErrorBoundary>
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
                    <View className="bg-red-500 px-3 py-2">
                      <Text className="text-center text-sm font-medium text-white">
                        You are offline
                      </Text>
                    </View>
                  )}
                  <PortalHost />
                </KeyboardProvider>
              </ToastProvider>
            </NotificationProvider>
          </AuthErrorBoundary>
        </AuthProvider>
      </ConvexProvider>
    </GestureHandlerRootView>
  );
}
