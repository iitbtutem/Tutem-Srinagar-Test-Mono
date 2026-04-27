import { useToast } from '@/components/CustomToast';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@clerk/expo';
import { api } from '@tutem/api';
import { useMutation, useQuery } from 'convex/react';
import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ImageBackground, View } from 'react-native';

export default function RegisterAsRider() {
  const { userId } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
    const { expoPushToken } = useNotification();

  const rider = useQuery(api.routes.rider.getRider, { clerkId: userId ?? '' });
  const registerAsRider = useMutation(api.routes.rider.registerAsRider);

  const handleRegisterAsRider = async () => {
    if(expoPushToken !== null)
      await registerAsRider({ clerkId: userId ?? '', expoPushToken: expoPushToken });
  };

  if (rider && rider.riderDetails) <Redirect href="/" />;

  return (
     <ImageBackground
          source={require('@/assets/images/background.png')}
          imageStyle={{ opacity: 0.15 }}
          className="flex-1 bg-background">
    <View className="flex-1 justify-center p-6">
      <View className="items-center justify-center">
        {/* Status Badge */}
        <View className="mb-8 rounded-full bg-green-100 px-4 py-2">
          <Text className="text-sm font-semibold text-green-700">✓ Account Verified</Text>
        </View>

        {/* Icon/Illustration */}
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Text className="text-4xl">🚕</Text>
        </View>

        {/* Main Message */}
        <Text className="mb-2 text-center text-2xl font-bold text-foreground">
          Ready to Start Riding?
        </Text>

        <Text className="mb-8 px-4 text-center text-base text-muted-foreground">
          Your account is already registered. Complete your rider registration to start booking
          rides.
        </Text>
      </View>

      {/* Action Button */}
      <Button onPress={handleRegisterAsRider}>
        <Text>Submit Rider Registration</Text>
      </Button>
    </View>
    </ImageBackground>
  );
}
