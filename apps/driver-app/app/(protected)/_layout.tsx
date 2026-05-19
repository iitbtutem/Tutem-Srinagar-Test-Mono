import CustomHeader from '@/components/CustomHeader';
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
        headerShown: true,
        header: (props) => user && <CustomHeader {...props} user={user} />,
        }}>
        <Stack.Protected guard={protectedGuard && user?.driverDetails !== null}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="editProfile"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="createVehicle"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="editVehicle"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
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
