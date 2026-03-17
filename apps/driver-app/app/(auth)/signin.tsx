import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Mail, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AntDesign from '@expo/vector-icons/AntDesign';

export default function Signin() {
  const [number, setNumber] = useState('');

  const handleChangeNumber = (input: string) => {
    // Remove any non-numeric characters
    const numericInput = input.replace(/[^0-9]/g, '');
    // Limit to 10 digits
    const truncated = numericInput.slice(0, 10);

    console.log('numeric input : ', truncated);
    setNumber(truncated);
  };

  function HR({ text }: { text: string }) {
    return (
      <View className="my-2 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-sm text-muted-foreground">{text}</Text>
        <View className="h-px flex-1 bg-border" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 gap-3 bg-background px-4 py-10">
      <Text className="text-xl font-[320] tracking-wider">Enter your mobile number</Text>
      <View className="relative">
        <Input
          inputMode="tel"
          placeholder="Mobile number"
          maxLength={10}
          onChangeText={handleChangeNumber}
          className="h-12 rounded-lg border-black bg-gray-100 pl-14 focus:border-2" // Add left padding
          value={number}
        />
        <Text className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">+91</Text>
      </View>
      <Button size={'lg'}>
        <Text className="text-base font-semibold">Continue</Text>
      </Button>
      <HR text="or" />
      <Button variant={'secondary'} size={'lg'}>
        <AntDesign name="google" size={20} color="black" />
        <Text className="text-base font-semibold">Continue with Google</Text>
      </Button>
      <Button variant={'secondary'} size={'lg'}>
        <Mail size={20} />
        <Text className="text-base font-semibold">Continue with Email</Text>
      </Button>
      <HR text="or" />
      <Pressable className="my-3 flex flex-row items-center justify-center gap-x-3">
        <Search size={20} />
        <Text className="text-center text-base font-semibold">Find my account</Text>
      </Pressable>
      <Text className="mt-3 text-xs font-normal text-gray-600">
        By continuing, you agree to calls, including by autodialer, Whatsapp, or texts from Uber and
        its affiliates.
      </Text>
    </SafeAreaView>
  );
}
