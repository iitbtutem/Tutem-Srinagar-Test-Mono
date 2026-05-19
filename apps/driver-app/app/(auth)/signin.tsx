import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { TriangleAlert } from 'lucide-react-native';
import { View, ActivityIndicator, ImageBackground } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth, useSignIn, useSignUp } from '@clerk/expo';
import { useToast } from '@/components/CustomToast';
import { useState } from 'react';
import { useConvexAuth } from 'convex/react';

const emailSchema = z.object({
  email: z.email('Enter a valid email address.'),
});

export default function Signin() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const { isSignedIn, isLoaded } = useAuth();
  const { isAuthenticated, isLoading } = useConvexAuth();

  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
    },
  });

  const handleContinue = async ({ email }: z.infer<typeof emailSchema>) => {
    setLoading(true);

    try {
      // First, try to start a sign-in to check if user already exists
      const { error } = await signIn.create({
        identifier: email,
      });
      // User exists — send OTP to the email
      if (error) {
        if ((error as any).errors[0].code === 'form_identifier_not_found') {
          try {
            await signUp.create({ emailAddress: email });
          } catch (err) {
            showToast({ title: 'Error', type: 'error', description: 'Failed to Sign Up' });
          }

          await signUp.verifications.sendEmailCode();

          router.push({
            pathname: '/otp',
            params: { email, mode: 'signup' },
          });
          return;
        }
      }

      await signIn.emailCode.sendCode({ emailAddress: email });

      // Navigate to OTP screen in "signin" mode
      router.push({
        pathname: '/otp',
        params: { email, mode: 'signin' },
      });
    } catch (signInError: any) {
      showToast({ title: 'Error', type: 'error', description: 'Failed to Sign In' });
    } finally {
      setLoading(false);
    }
  };
  if (isLoading || !isLoaded) return <ActivityIndicator />
  if (isSignedIn && isAuthenticated) return <Redirect href={'/'} />

  return (
    <View className="flex-1 bg-background gap-3 px-4 py-10">
      <Text className="text-xl font-[320] tracking-wider">Enter your email address</Text>

      {/* Email input */}
      <View>
        <View className="relative">
          <Controller
            control={control}
            rules={{ required: true }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                inputMode="email"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="Email address"
                onBlur={onBlur}
                onChangeText={onChange}
                className="pl-4"
                value={value}
              />
            )}
            name="email"
          />
        </View>
        {errors.email && (
          <View className="flex-row items-center gap-x-1">
            <TriangleAlert size={15} color={'red'} />
            <Text className="text-md py-2 text-destructive">{errors.email.message}</Text>
          </View>
        )}
      </View>

      {/* Continue button */}
      <Button className='my-2' size="lg" onPress={handleSubmit(handleContinue)} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-base font-semibold">Continue</Text>
        )}
      </Button>

      <Text className="mt-3 text-xs text-gray-600">
        By continuing, you agree to our Terms of Service and Privacy Policy. A one-time verification
        code will be sent to your email.
      </Text>
    </View>
  );
}
