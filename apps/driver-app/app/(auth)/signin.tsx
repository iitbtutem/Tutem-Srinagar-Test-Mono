import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Mail, Search, TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const phoneNumberSchema = z.object({
  phoneNumber: z
    .string('Enter a valid phone number.')
    .min(10, 'Phone number must be 10 digits long.'),
});

export default function Signin() {
  const router = useRouter();

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(phoneNumberSchema),
    defaultValues: {
      phoneNumber: '',
    },
  });

  const handleSignIn = () => {
    router.push({
      pathname: '/otp',
      params: {
        phoneNumber: getValues('phoneNumber'),
      },
    });
  };

  return (
    <View className="flex-1 gap-3 bg-background px-4 py-10">
      <Text className="text-xl font-[320] tracking-wider">Enter your mobile number</Text>

      {/* mobile number input */}
      <View>
        <View className="relative">
          <Controller
            control={control}
            rules={{
              required: true,
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                inputMode="tel"
                placeholder="Mobile number"
                maxLength={10}
                onBlur={onBlur}
                onChangeText={(text) => {
                  const cleanedText = text.replace(/[^0-9]/g, '');
                  onChange(cleanedText);
                }}
                className="border-black bg-gray-100 pl-14 focus:border-2" // Add left padding
                value={value}
              />
            )}
            name="phoneNumber"
          />
          <Text className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">+91</Text>
        </View>
        {errors.phoneNumber && (
          <View className="flex-row items-center gap-x-1">
            <TriangleAlert size={15} color={'red'} />
            <Text className="text-md py-2 text-destructive">{errors.phoneNumber.message}</Text>
          </View>
        )}
      </View>

      {/* signin button */}
      <Button size="lg" onPress={handleSubmit(handleSignIn)}>
        <Text className="text-base font-semibold">Continue</Text>
      </Button>

      {/* horizontal line */}
      <View className="my-2 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-sm text-muted-foreground">or</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      {/* signIn with google */}
      <Button variant={'secondary'} size="lg">
        <AntDesign name="google" size={20} color="black" />
        <Text className="text-base font-semibold">Continue with Google</Text>
      </Button>

      {/* signIn with email */}
      <Button variant={'secondary'} size="lg">
        <Mail size={20} />
        <Text className="text-base font-semibold">Continue with Email</Text>
      </Button>

      {/* horizontal line */}
      <View className="my-2 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-sm text-muted-foreground">or</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      {/* find my account */}
      <Button variant={'ghost'}>
        <Search size={20} color={'black'} />
        <Text className="text-center text-base font-semibold">Find my account</Text>
      </Button>

      <Text className="mt-3 text-xs text-gray-600">
        By continuing, you agree to calls, including by autodialer, Whatsapp, or texts from Uber and
        its affiliates.
      </Text>
    </View>
  );
}
