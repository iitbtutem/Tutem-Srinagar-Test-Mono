import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
      <ConvexProvider client={convex}>
        <StatusBar
          backgroundColor="#edeef0"
          style={
            colorScheme === 'dark'
              ? 'light'
              : // : 'dark'
                'light'
          }
        />
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
        <PortalHost />
      </ConvexProvider>
    </ThemeProvider>
  );
}
