import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { OTP_SIZE } from '@/constants';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { TextInput, TextInputKeyPressEvent, View } from 'react-native';

export async function submitOtp(otp: string){
  const submitOtpPromise = new Promise((res, rej) => {
    setTimeout(() => {
      if(otp.length === 4){
      res("OTP validated successfully")
    } else{
      rej("OTP must be 4 digits")
    }
    }, 3* 1000)
    
  });
  return submitOtpPromise;
}

function OtpScreen() {
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber: string }>();
  const [inputArr, setInputArr] = useState<string[]>(
    new Array(OTP_SIZE).fill("")
  );
  
  const inputRef = useRef<(TextInput | null)[]>([]);

  const handleChange = (value: string, index: number) => {
    if(isNaN(Number(value))) return;
    const newValue = value.trim();
    const tempArr = [...inputArr];
    tempArr[index] = newValue.slice(-1);
    setInputArr(tempArr);
    
    if(value) inputRef.current[index + 1]?.focus();
    return;
  }

  const handleKeyPress = (e: TextInputKeyPressEvent, index: number) => {
    const key = e.nativeEvent.key.toLowerCase();
     if(key === "backspace" && !Boolean(inputArr[index])){
      inputRef.current[index - 1]?.focus();
     }
  };

  const sub = async () => {
    const res = await submitOtp(inputArr.join(""))
  };

  useEffect(() => {
    const missingNumber = inputArr.some(input => (isNaN(Number(input)) || input === ""))
    if(missingNumber) return;
    sub();
  }, [inputArr])

  useEffect(() => {
    inputRef.current[0]?.focus()
  }, [])

  return (
    <View className="flex-1 gap-3 bg-background px-4 py-10">
      <Text className='text-2xl font-semibold'>
        Enter the {OTP_SIZE}-digit code sent via SMS at 0{phoneNumber}.
      </Text>
      <View className='flex-row gap-2 w-full my-6'>
        {inputArr.map((i, idx) => {
          return (
            <Input
              key={idx}
              ref={(input) => {
                inputRef.current[idx] = input
              }}
              inputMode="numeric"
              onChangeText={(val) => handleChange(val, idx)}
              // maxLength={1}
              onKeyPress={(e) => handleKeyPress(e, idx)}
              className="text-center border-black border-0 bg-gray-100 focus:border-2 h-14 w-14"
              value={inputArr[idx]}
            />
          )
        })}
        
      </View>
    </View>
  );
}

export default OtpScreen;
