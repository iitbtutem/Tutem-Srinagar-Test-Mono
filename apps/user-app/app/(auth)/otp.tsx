import { Text, Input, Button, Loader } from '@tutem/ui';
import { OTP_SIZE, OTP_TIMER } from '@/constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, TextInput, TextInputKeyPressEvent, View } from 'react-native';
import { useToast } from '@/components/CustomToast';
import { useAuth } from '@/hooks/useAuth';
import { useAction } from 'convex/react';
import { api } from '@tutem/api';

export default function OtpScreen() {
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber: string }>();
  const [inputArr, setInputArr] = useState<string[]>(new Array(OTP_SIZE).fill(''));
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(OTP_TIMER);

  const router = useRouter();
  const inputRef = useRef<(TextInput | null)[]>([]);
  const { showToast } = useToast();
  const { signIn } = useAuth();

  const verifyOtpAction = useAction(api.actions.auth.verifyOtp);
  const sendOtpAction = useAction(api.actions.auth.sendOtp);

  const handleChange = (value: string, index: number) => {
    const cleanedValue = value.replace(/[^0-9]/g, '');
    if (cleanedValue.length > 1) {
      const tempArr = [...inputArr];
      for (let i = 0; i < OTP_SIZE - index; i++) {
        if (i < cleanedValue.length) {
          tempArr[index + i] = cleanedValue[i];
        }
      }
      setInputArr(tempArr);
      Keyboard.dismiss();
      return;
    }

    if (isNaN(Number(value))) return;
    const tempArr = [...inputArr];
    tempArr[index] = value.trim().slice(-1);
    setInputArr(tempArr);
    if (value) inputRef.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: TextInputKeyPressEvent, index: number) => {
    if (e.nativeEvent.key.toLowerCase() === 'backspace' && !inputArr[index]) {
      inputRef.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otp: string) => {
    setLoading(true);
    try {
      const result = await verifyOtpAction({ phoneNumber, otp });

      if (router.canDismiss()) router.dismissAll();

      if (result.userExists && result.sessionToken) {
        await signIn(result.sessionToken, phoneNumber);
        router.replace('/(protected)');
      } else {
        router.replace({
          pathname: '/register',
          params: { phoneNumber },
        });
      }
    } catch (err: any) {
      const message = err?.data ?? err?.message ?? 'Invalid OTP. Please try again.';
      showToast({ title: 'Error', description: message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setTimer(OTP_TIMER);
    try {
      await sendOtpAction({ phoneNumber });
      showToast({
        title: 'Code sent',
        description: `A new code was sent to ${phoneNumber}`,
        type: 'success',
      });
    } catch (err: any) {
      const message = err?.data ?? err?.message ?? 'Failed to resend code.';
      showToast({ title: 'Error', description: message, type: 'error' });
    }
  };

  useEffect(() => {
    inputRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (timer > 0) {
      const t = setTimeout(() => setTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timer]);

  return (
    <View className="flex-1 bg-background px-4 py-10">
      <Text className="text-center" variant="title">
        Verify Your Phone
      </Text>

      <Text variant="muted" className="mb-2 text-center">
        Enter the {OTP_SIZE}-digit code sent to{'\n'} {phoneNumber}.
      </Text>

      {/* OTP input boxes */}
      <View className="my-6 w-full flex-row gap-2">
        {inputArr.map((_, idx) => (
          <Input
            key={idx}
            ref={(input) => {
              inputRef.current[idx] = input;
            }}
            inputMode="numeric"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            onChangeText={(val: string) => handleChange(val, idx)}
            onKeyPress={(e: TextInputKeyPressEvent) => handleKeyPress(e, idx)}
            className="h-14 w-12 text-center"
            value={inputArr[idx]}
            editable={!loading}
            returnKeyType={idx === OTP_SIZE - 1 ? 'done' : 'next'}
            onSubmitEditing={
              idx === OTP_SIZE - 1
                ? () => {
                    const code = inputArr.join('');
                    if (code.length === OTP_SIZE) Keyboard.dismiss();
                  }
                : undefined
            }
          />
        ))}
      </View>

      <View className="mt-2 items-center gap-y-4">
        {/* Verify button */}
        <Button
          className="w-full"
          onPress={() => {
            if (inputArr.some((v) => v === '' || isNaN(Number(v)))) return;
            const code = inputArr.join('');
            handleVerify(code);
          }}
          disabled={loading || inputArr.some((v) => v === '')}>
          <Text className="text-base">Verify OTP</Text>
          <ArrowRight size={20} color="#fff" strokeWidth={3} />
        </Button>

        {/* Resend */}
        <View className="flex-row items-center">
          <Text variant="link" className="text-center">
            Didn't receive OTP?
          </Text>
          <Button variant="link" onPress={resendOtp} disabled={timer > 0 || loading}>
            <Text>Resend{timer > 0 ? ` (0:${String(timer).padStart(2, '0')})` : null}</Text>
          </Button>
        </View>
      </View>

      {/* Back button */}
      <Button
        className="h-18 mt-auto self-start rounded-3xl bg-slate-950/5"
        onPress={() => router.canGoBack() && router.back()}
        disabled={loading}>
        <ArrowLeft size={20} color="#000" strokeWidth={3} />
        <Text className="text-base text-black">Back</Text>
      </Button>

      {loading && <Loader subtitle="verifying" />}
    </View>
  );
}
