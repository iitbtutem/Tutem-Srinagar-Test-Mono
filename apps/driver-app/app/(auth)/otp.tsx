import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { OTP_SIZE, OTP_TIMER } from '@/constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { TextInput, TextInputKeyPressEvent, View } from 'react-native';

export async function submitOtp(otp: string) {
  const submitOtpPromise = new Promise((res, rej) => {
    setTimeout(() => {
      if (otp.length === 4) {
        res('OTP validated successfully');
      } else {
        rej('OTP must be 4 digits');
      }
    }, 3 * 1000);
  });
  return submitOtpPromise;
}

function OtpScreen() {
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber: string }>();
  const [inputArr, setInputArr] = useState<string[]>(new Array(OTP_SIZE).fill(''));

  const router = useRouter();
  const inputRef = useRef<(TextInput | null)[]>([]);

  const handleChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return;
    const newValue = value.trim();
    const tempArr = [...inputArr];
    tempArr[index] = newValue.slice(-1);
    setInputArr(tempArr);

    if (value) inputRef.current[index + 1]?.focus();
    return;
  };

  const handleKeyPress = (e: TextInputKeyPressEvent, index: number) => {
    const key = e.nativeEvent.key.toLowerCase();
    if (key === 'backspace' && !Boolean(inputArr[index])) {
      inputRef.current[index - 1]?.focus();
    }
  };

  const sub = async () => {
    try {
      const res = await submitOtp(inputArr.join(''));
      router.push("./register")
    } catch (error) {
      console.log("Error", error)
    }
  };

  function resendOtp() {
    setTimer(9);
  }

  function getOtpViaCall() {}

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    }
    return;
  }

  useEffect(() => {
    const missingNumber = inputArr.some((input) => isNaN(Number(input)) || input === '');
    if (missingNumber) return;
    sub();
  }, [inputArr]);

  useEffect(() => {
    inputRef.current[0]?.focus();
  }, []);

  const [timer, setTimer] = useState(OTP_TIMER);
  useEffect(() => {
    if (timer > 0) {
      setTimeout(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
  }, [timer]);

  return (
    <View className="flex-1 gap-3 bg-background px-4 py-10">
      <Text className="text-2xl font-semibold">
        Enter the {OTP_SIZE}-digit code sent via SMS at 0{phoneNumber}.
      </Text>

      {/* OTP input */}
      <View className="my-6 w-full flex-row gap-2">
        {inputArr.map((i, idx) => {
          return (
            <Input
              key={idx}
              ref={(input) => {
                inputRef.current[idx] = input;
              }}
              inputMode="numeric"
              onChangeText={(val) => handleChange(val, idx)}
              // maxLength={1}
              onKeyPress={(e) => handleKeyPress(e, idx)}
              className="h-14 w-14 border-0 border-black bg-gray-100 text-center focus:border-2"
              value={inputArr[idx]}
            />
          );
        })}
      </View>

      {/* OTP buttons */}
      <View className="mt-3 gap-y-4">
        <Button
          className="self-start rounded-full"
          variant={'secondary'}
          onPress={resendOtp}
          disabled={timer > 0 ? true : false}>
          <Text>
            Resend code via SMS
            {timer > 0 ? ` (0:0${timer})` : null}
          </Text>
        </Button>
        <Button className="self-start rounded-full" onPress={getOtpViaCall} variant={'secondary'}>
          <Text>Call me with Code</Text>
        </Button>
      </View>

      {/* Navigation Buttons */}
      <View className="mt-auto flex-row justify-between">
        <Button
          className="h-12 w-12 items-center justify-center rounded-full"
          onPress={goBack}
          variant={'secondary'}>
          <ArrowLeft />
        </Button>
        <Button className="h-18 self-start rounded-3xl" variant={'secondary'}>
          <Text className="text-base">Next</Text>
          <ArrowRight size={20} />
        </Button>
      </View>
    </View>
  );
}

export default OtpScreen;
