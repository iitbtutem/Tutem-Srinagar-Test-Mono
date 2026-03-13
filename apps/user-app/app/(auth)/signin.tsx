import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    </SafeAreaView>
  );
}
