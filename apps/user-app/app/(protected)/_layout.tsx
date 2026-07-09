import { useAuth } from '@/hooks/useAuth';
import { useRider } from '@/hooks/useRider';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProtectedLayout() {
  const { sessionToken } = useAuth();
  const { rider } = useRider();

  const protectedGuard = !!sessionToken && !!rider;

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-primary">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={protectedGuard && !!rider.riderDetails}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="editProfile" />
        </Stack.Protected>
        <Stack.Screen name="register" />
        <Stack.Protected guard={protectedGuard && rider.riderDetails === null}>
          <Stack.Screen name="registerAsRider" />
        </Stack.Protected>
      </Stack>
    </SafeAreaView>
  );
}
