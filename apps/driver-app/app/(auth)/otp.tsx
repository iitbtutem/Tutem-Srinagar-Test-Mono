import { Text, Input, Button, Loader } from '@tutem/ui';
import { OTP_SIZE, OTP_TIMER } from '@/constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  TextInput,
  TextInputKeyPressEvent,
  View,
} from 'react-native';
import { useSignIn, useSignUp } from '@clerk/expo';
import { useToast } from '@/components/CustomToast';

export default function OtpScreen() {
  const { email, mode } = useLocalSearchParams<{ email: string; mode: 'signin' | 'signup' }>();
  const [inputArr, setInputArr] = useState<string[]>(new Array(OTP_SIZE).fill(''));
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const inputRef = useRef<(TextInput | null)[]>([]);
  const { showToast } = useToast();

  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const handleChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return;
    const newValue = value.trim();
    const tempArr = [...inputArr];
    tempArr[index] = newValue.slice(-1);
    setInputArr(tempArr);

    if (value) inputRef.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: TextInputKeyPressEvent, index: number) => {
    const key = e.nativeEvent.key.toLowerCase();
    if (key === 'backspace' && !Boolean(inputArr[index])) {
      inputRef.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async (code: string) => {
    setLoading(true);

    try {
      if (mode === 'signup') {
        // New user — verify email code via signUp
        await signUp.verifications.verifyEmailCode({ code });

        if (signUp.status === 'complete') {
          await signUp.finalize({
            navigate: () => {
              if (router.canDismiss()) router.dismissAll();
              router.replace('/(protected)');
            },
          });
        } else {
          console.log('error in signUP');
          showToast({
            title: 'Error',
            description: 'Verification Failed. Try again.',
            type: 'error',
          });
        }
      } else {
        // Existing user — verify email code via signIn
        await signIn.emailCode.verifyCode({ code });

        if (signIn.status === 'complete') {
          await signIn.finalize({
            navigate: () => {
              if (router.canDismiss()) router.dismissAll();
              router.replace('/(protected)');
            },
          });
        } else {
          console.log('error in signin');
          showToast({
            title: 'Error',
            description: 'Verification Failed. Try again.',
            type: 'error',
          });
        }
      }
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage ?? 'Invalid code. Please try again.';
      showToast({ title: 'Error', description: message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  async function resendOtp() {
    setTimer(OTP_TIMER);
    try {
      if (mode === 'signup') {
        console.log('i am resending');
        await signUp.verifications.sendEmailCode();
      } else {
        await signIn.emailCode.sendCode({ emailAddress: email });
      }
      showToast({
        title: 'Code sent',
        description: `A new code was sent to ${email}`,
        type: 'success',
      });
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage ?? 'Failed to resend code.';
      showToast({ title: 'Error', description: message, type: 'error' });
    }
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    }
  }

  useEffect(() => {
    inputRef.current[0]?.focus();
  }, []);

  const [timer, setTimer] = useState(OTP_TIMER);
  useEffect(() => {
    if (timer > 0) {
      const t = setTimeout(() => setTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timer]);

  return (
    <View className="flex-1 px-4 py-10 bg-background" >
      <Text className='text-center' variant={"title"}>Verify Your Email</Text>
      
      <Text variant={"muted"} className='text-center mb-2'>
        Enter the {OTP_SIZE}-digit code sent to {`\n`} {email}.
      </Text>

      {/* OTP input */}
      <View className="my-6 w-full flex-row gap-2">
        {inputArr.map((_, idx) => (
          <Input
            key={idx}
            ref={(input) => {
              inputRef.current[idx] = input;
            }}
            inputMode="numeric"
            onChangeText={(val) => handleChange(val, idx)}
            onKeyPress={(e) => handleKeyPress(e, idx)}
            className="h-14 w-12 text-center"
            value={inputArr[idx]}
            editable={!loading}
            returnKeyType={idx === OTP_SIZE - 1 ? 'done' : 'next'}
            onSubmitEditing={
              idx === OTP_SIZE - 1
                ? () => {
                    const code = inputArr.join('');
                    if (code.length !== OTP_SIZE) return;
                    verifyOtp(code);
                  }
                : undefined
            }
          />
        ))}
      </View>

      <View className="mt-2 gap-y-4 items-center">
        {/* submit button */}
        <Button
          className="w-full"
            onPress={() => {
              const missingNumber = inputArr.some((input) => isNaN(Number(input)) || input === '');
              if (missingNumber) return;
              console.log(inputArr.join(''));
              verifyOtp(inputArr.join(''));
            }}
            disabled={loading || inputArr.some((v) => v === '')}>
            <Text className="text-base">Verify OTP</Text>
            <ArrowRight size={20} color={'#fff'} strokeWidth={3} />
          </Button>

        {/* resend otp */}
        <View className="flex-row items-center">
          <Text variant={"link"} className='text-center'>
            Didn't receive OTP?
          </Text>
          <Button
            variant={'link'}
            onPress={resendOtp}
            disabled={timer > 0 || loading}>
            <Text>
              Resend
              {timer > 0 ? ` (0:${String(timer).padStart(2, '0')})` : null}
            </Text>
          </Button>
        </View>
      </View>

      {/* Back Button */}
      <Button
        className="h-18 self-start rounded-3xl bg-slate-950/5 mt-auto"
        onPress={goBack}
        disabled={loading}>
        <ArrowLeft size={20} color={'#000'}  strokeWidth={3} />
        <Text className="text-base text-black">Back</Text>
      </Button>

      {loading && <Loader subtitle='verifying' /> }
    </View>
  );
}
