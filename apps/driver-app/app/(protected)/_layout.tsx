
import { useAuth } from '@/hooks/useAuth';
import { useDriver } from '@/hooks/useDriver';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProtectedLayout() {
  const { sessionToken } = useAuth();
  const { driver: user } = useDriver();

  const protectedGuard = !!sessionToken && !!user;

  return (
    <SafeAreaView edges={["bottom"]} className='flex-1' >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={protectedGuard && user?.driverDetails !== null}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="editProfile"
          />
          <Stack.Screen
            name="createVehicle"
            options={{
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="editVehicle"
            options={{
              animation: 'fade',
            }}
          />
        </Stack.Protected>
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
        <Stack.Screen name="registerAsDriver" />
      </Stack>
    </SafeAreaView>
  );
}
