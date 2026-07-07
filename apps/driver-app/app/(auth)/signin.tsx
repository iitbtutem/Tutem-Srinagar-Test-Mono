import { Text, Input, Button, Loader } from '@tutem/ui';
import { TriangleAlert } from 'lucide-react-native';
import { View, ActivityIndicator } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/CustomToast';
import { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@tutem/api';

const phoneSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\d+$/, 'Phone number must contain only digits')
    .length(10, 'Phone number must be exactly 10 digits'),
});

export default function Signin() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const { isSignedIn, isLoaded } = useAuth();

  const sendOtp = useAction(api.actions.auth.sendOtp);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: '' },
  });

  const handleContinue = async ({ phoneNumber }: z.infer<typeof phoneSchema>) => {
    setLoading(true);
    try {
      await sendOtp({ phoneNumber });

      router.push({
        pathname: '/otp',
        params: { phoneNumber },
      });
    } catch (err: any) {
      showToast({
        title: 'Error',
        type: 'error',
        description: err?.data ?? 'Failed to send OTP. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) return <Loader subtitle="Loading..." />;
  if (isSignedIn) return <Redirect href={'/'} />;

  return (
    <View className="px-4 pt-10">
      <Text className="text-center" variant="title">
        Verify Your Phone Number
      </Text>

      <Text variant="muted" className="mb-2 text-center">
        Enter your mobile number to generate OTP
      </Text>
      <Text variant="muted" className="mb-6 text-center">
        You will receive a one-time OTP to verify your number.
      </Text>

      {/* Phone number input */}
      <View className="mb-3 w-full">
        <Controller
          control={control}
          rules={{ required: true }}
          render={({ field: { onChange, onBlur, value } }) => (
            <View className="relative">
              <Input
                inputMode="tel"
                keyboardType="phone-pad"
                autoCapitalize="none"
                placeholder="Enter Phone Number"
                onBlur={onBlur}
                onChangeText={onChange}
                className="pl-14"
                value={value}
                maxLength={10}
              />
              <Text className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">+91</Text>
            </View>
          )}
          name="phoneNumber"
        />
        {errors.phoneNumber && (
          <View className="mt-1 flex-row items-center gap-x-1">
            <TriangleAlert size={15} color="red" />
            <Text className="text-md py-2 text-destructive">{errors.phoneNumber.message}</Text>
          </View>
        )}
      </View>

      <Button className="my-3 w-full" onPress={handleSubmit(handleContinue)} disabled={loading}>
        {loading ? <ActivityIndicator color="white" /> : <Text>Continue →</Text>}
      </Button>

      <Text className="mt-3 text-xs text-gray-600">
        By continuing, you agree to our Terms of Service and Privacy Policy. A one-time verification
        code will be sent to your phone number.
      </Text>
    </View>
  );
}
