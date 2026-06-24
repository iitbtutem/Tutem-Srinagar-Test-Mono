import { useToast } from '@/components/CustomToast';
import { Text, Button, Loader, Avatar, AvatarImage, AvatarFallback, GenderAge } from '@tutem/ui';
import { useNotification } from '@/context/NotificationContext';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useRider } from '@/hooks/useRider';
import { api } from '@tutem/api';
import { useMutation } from 'convex/react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useState } from 'react';

export default function RegisterAsRider() {
  const { userId } = useAuthUser();
  const { showToast } = useToast();
  const { expoPushToken } = useNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { rider } = useRider();
  const registerAsRider = useMutation(api.routes.rider.registerAsRider);

  const handleRegisterAsRider = async () => {
    if (expoPushToken !== null)
      try {
        setIsSubmitting(true);
        await registerAsRider({ userId: userId ?? '', expoPushToken: expoPushToken });
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

  if (rider && rider.riderDetails) return <Redirect href="/" />;
  if (rider === null) return <Redirect href="/register" />;
  if (rider === undefined) return <Loader subtitle="Loading account" />;

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

      <View className="flex-row items-center border border-primary rounded-2xl my-8 p-3 gap-2">
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
