import { useToast } from '@/components/CustomToast';
import { Text, Button, Loader, Avatar, AvatarImage, AvatarFallback, GenderAge } from '@tutem/ui';
import { useNotification } from '@/context/NotificationContext';
import { useRider } from '@/hooks/useRider';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@tutem/api';
import { useMutation } from 'convex/react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useState } from 'react';

export default function RegisterAsRider() {
  const { showToast } = useToast();
  const { expoPushToken } = useNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { sessionToken } = useAuth();
  const { rider, isLoading: riderIsLoading } = useRider();
  const registerAsRider = useMutation(api.routes.rider.registerAsRider);

  const handleRegisterAsRider = async () => {
    if (expoPushToken === null || sessionToken === null) return;

    try {
      setIsSubmitting(true);
      await registerAsRider({
        sessionToken,
        expoPushToken,
      });
      showToast({
        type: 'success',
        title: 'Registered',
        description: 'Registration done successfully',
      });
    } catch (error: any) {
      console.log(`error ${error}`);
      showToast({
        type: 'error',
        title: 'Failed',
        description: error.data ?? 'Failed to register',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (riderIsLoading) return <Loader subtitle="Loading account" />;
  if (rider && rider.riderDetails) return <Redirect href="/" />;
  if (!rider) return <Redirect href="/register" />;

  return (
    <View className="flex-1 bg-background p-6">
      {isSubmitting && <Loader subtitle="Registering..." />}
      <View>
        {/* Icon/Illustration */}
        <View className="mx-auto my-6 h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Text className="text-4xl">🚕</Text>
        </View>

        {/* Main Message */}
        <Text className="mb-2 text-center text-2xl font-bold text-foreground">
          Ready to Start Riding?
        </Text>

        <Text className="px-4 text-center text-base text-muted-foreground">
          Your account is already registered. Complete your rider registration to start booking
          rides.
        </Text>
      </View>

      <View className="my-8 flex-row items-center gap-2 rounded-2xl border border-primary p-3">
        <Avatar alt="Profile pic" className="h-16 w-16">
          <AvatarImage
            source={
              rider.profilePictureKey?.trim()
                ? { uri: rider.profilePictureKey }
                : require('@/assets/images/avatar.jpg')
            }
          />
          <AvatarFallback className="bg-white/20">
            <Text className="text-sm font-bold text-primary">
              {rider.firstName?.[0]}
              {rider.lastName?.[0]}
            </Text>
          </AvatarFallback>
        </Avatar>

        <View>
          <Text className="text-lg font-semibold">{rider.firstName + (rider?.lastName ?? '')}</Text>
          <GenderAge dob={rider.dob} gender={rider.gender} />
          <Text className="text-[12px] font-medium">{rider.phoneNumber}</Text>
        </View>
      </View>

      {/* Action Button */}
      <Button onPress={handleRegisterAsRider}>
        <Text>Submit Rider Registration</Text>
      </Button>
    </View>
  );
}
