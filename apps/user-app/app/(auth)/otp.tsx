import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { OTP_SIZE, OTP_TIMER } from '@/constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  TextInput,
  TextInputKeyPressEvent,
  View,
} from 'react-native';
import { useSignIn, useSignUp } from '@clerk/expo';
import { useToast } from '@/components/CustomToast';
import { colorScheme } from 'nativewind';

export default function OtpScreen() {
  const { email, mode } = useLocalSearchParams<{ email: string; mode: 'signin' | 'signup' }>();
  const [inputArr, setInputArr] = useState<string[]>(new Array(OTP_SIZE).fill(''));
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const inputRef = useRef<(TextInput | null)[]>([]);
  const { showToast } = useToast();

  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const theme = colorScheme.get();

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
              router.replace('/register');
            },
          });
        } else {
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
              router.replace('/register');
            },
          });
        } else {
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
    <ScrollView
      className="bg-background px-4 py-10"
      contentContainerStyle={{ flexGrow: 1, gap: 12 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <Text className="text-2xl font-semibold">
        Enter the {OTP_SIZE}-digit code sent to {email}.
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

      {loading && (
        <View className="items-center py-2">
          <ActivityIndicator size="small" />
          <Text className="mt-2 text-sm text-muted-foreground">Verifying...</Text>
        </View>
      )}

      {/* OTP action buttons */}
      <View className="mt-3 gap-y-4">
        <Button
          className="self-start rounded-full"
          variant={'secondary'}
          onPress={resendOtp}
          disabled={timer > 0 || loading}>
          <Text>
            Resend code via email
            {timer > 0 ? ` (0:${String(timer).padStart(2, '0')})` : null}
          </Text>
        </Button>
      </View>

      {/* Navigation Buttons */}
      <View
        style={{
          marginTop: 'auto',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingTop: 24,
        }}>
        <Button
          className="h-12 w-12 items-center justify-center rounded-full"
          onPress={goBack}
          variant={'secondary'}
          disabled={loading}>
          <ArrowLeft size={24} color={theme === 'light' ? '#000' : '#fff'} />
        </Button>
        <Button
          className="h-18 self-start rounded-3xl"
          variant={'secondary'}
          onPress={() => {
            const missingNumber = inputArr.some((input) => isNaN(Number(input)) || input === '');
            if (missingNumber) return;
            verifyOtp(inputArr.join(''));
          }}
          disabled={loading || inputArr.some((v) => v === '')}>
          <Text className="text-base">Verify</Text>
          <ArrowRight size={20} color={theme === 'light' ? '#000' : '#fff'} />
        </Button>
      </View>
    </ScrollView>
  );
}
