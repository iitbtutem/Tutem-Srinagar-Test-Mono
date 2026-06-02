
import { useAuth } from '@clerk/expo';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProtectedLayout() {
  const { userId } = useAuth();
  const user = useQuery(api.routes.driver.getUser, userId && userId !== '' ? { clerkId: userId } : 'skip');

  const protectedGuard = !!userId && !!user;

  return (
    <SafeAreaView edges={["bottom"]} className='flex-1' >
      <Stack screenOptions={{ 
        headerShown: false,
        }}>
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
