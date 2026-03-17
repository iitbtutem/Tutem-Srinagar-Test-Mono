import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Mail, Search, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useRouter } from 'expo-router';

export default function Signin() {
  const [number, setNumber] = useState('');
  const [numberError, setNumberError] = useState('');
  const router = useRouter();

  const handleChangeNumber = (input: string) => {
    // Remove any non-numeric characters
    const numericInput = input.replace(/[^0-9]/g, '');
    // Limit to 10 digits
    const truncated = numericInput.slice(0, 10);
    if (numberError) {
      setNumberError('');
    }
    setNumber(truncated);
  };

  const handleSignIn = () => {
    if (number.length !== 10) {
      setNumberError('Number must be 10 digit long.');
      return;
    }
    router.push({
      pathname: '/otp',
      params: {
        phoneNumber: number,
      },
    });
  };

  return (
    <View className="flex-1 gap-3 bg-background px-4 py-10">
      <Text className="text-xl font-[320] tracking-wider">Enter your mobile number</Text>

      {/* mobile number input */}
      <View>
        <View className="relative">
          <Input
            inputMode="tel"
            placeholder="Mobile number"
            maxLength={10}
            onChangeText={handleChangeNumber}
            className="border-black bg-gray-100 pl-14 focus:border-2" // Add left padding
            value={number}
          />
          <Text className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">+91</Text>
        </View>
        {numberError && (
          <View className="flex-row items-center gap-x-1">
            <TriangleAlert size={15} color={'red'} />
            <Text className="text-md py-2 text-destructive">{numberError}</Text>
          </View>
        )}
      </View>

      {/* signin button */}
      <Button size="lg" onPress={handleSignIn}>
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
