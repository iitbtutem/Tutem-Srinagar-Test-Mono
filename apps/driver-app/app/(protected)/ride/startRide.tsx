import { useToast } from '@/components/CustomToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { RIDE_OTP_TIMER_MINUTES } from '@/constants';
import { useCountdown } from '@/hooks/useCountdown';
import { api, Id } from '@tutem/api';
import { useAction, useQuery } from 'convex/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, TextInput, TextInputKeyPressEvent, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

const RIDE_OTP_SIZE = 4;

export default function startRide() {
  const { rideId, driverId } = useLocalSearchParams<{
    rideId: Id<'ride'>;
    driverId: Id<'driver'>;
  }>();

  const [inputArr, setInputArr] = useState<string[]>(new Array(RIDE_OTP_SIZE).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<'start' | 'resend' | null>(null);
  
  const { formattedTime, timeLeft, reset } = useCountdown({ initialTime: RIDE_OTP_TIMER_MINUTES * 60})
  const { showToast } = useToast();
  const inputRef = useRef<(TextInput | null)[]>([]);

  const ride = useQuery(
    api.routes.rides.getRideToStart,
    driverId && rideId ? { id: rideId, driverId } : 'skip'
  );

  const startRide = useAction(api.actions.ride.startRide);
  const generateRideOtp = useAction(api.actions.ride.generateRideOtp)

  const handleChange = (value: string, index: number) => {
    const newValue = value.trim();
    const tempArr = [...inputArr];
    tempArr[index] = newValue.slice(-1);
    setInputArr(tempArr);
    if (error) setError('');
    if (value) inputRef.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: TextInputKeyPressEvent, index: number) => {
    const key = e.nativeEvent.key.toLowerCase();
    if (key === 'backspace' && !Boolean(inputArr[index])) {
      inputRef.current[index - 1]?.focus();
    }
  };
  
  const otp = inputArr.join('');

  const verifyOtp = async () => {
    if (!ride || !driverId) {
      showToast({ type: 'error', title: 'Failed to start ride' });
      return;
    }
    try {
      setLoading('start');
      if (otp.length !== RIDE_OTP_SIZE) {
        setError('Invalid OTP');
        return;
      }
      console.log(otp, " OTP")
      await startRide({ driverId, rideId, otp: Number(otp) });
      showToast({ title: 'Ride Started', description: 'Have a safe trip!', type: 'success' });
      router.back();
    } catch (e: any) {
      console.error(e);
      showToast({ title: 'Failed', description: e.data ?? 'Failed to start ride', type: 'error' });
    } finally {
      setLoading(null);
    }
  };

  const resendOtp = async () => {
    try {
      await generateRideOtp({ rideId })
      reset();
    } catch (error: any) {
      console.log(`error: ${error}`)
      showToast({
        type: "error",
        title: "Can't Resend OTP",
        description: error.data ?? "Failed to resend otp. Try Again"
      })
    }
  }

  if (ride === undefined) return <ActivityIndicator />;
  if (ride === null || ride.status !== "Driver Arrived") return;

  return (
    <Animated.View entering={FadeInDown.delay(200)} className="flex-1 p-6 mb-4 items-center">
      <View className="mb-6 w-full flex-row justify-center gap-3">
        {inputArr.map((_, idx) => (
          <Input
            key={idx}
            keyboardType='number-pad'
            ref={(input) => { inputRef.current[idx] = input; }}
            onChangeText={(val) => handleChange(val, idx)}
            onKeyPress={(e) => handleKeyPress(e, idx)}
            className="h-14 w-12 text-center"
            value={inputArr[idx]}
            returnKeyType={idx === RIDE_OTP_SIZE - 1 ? 'done' : 'next'}
            onSubmitEditing={
              idx === RIDE_OTP_SIZE - 1
                ? () => {
                    if (inputArr.join('').length !== RIDE_OTP_SIZE) return;
                    verifyOtp();
                  }
                : undefined
            }
          />
        ))}
      </View>
      {error && <Text className="text-md text-destructive mb-2 -mt-4">⚠ {error}</Text>}
      <Button
        className="w-full items-center justify-center rounded-2xl"
        disabled={!!loading || otp.length !== RIDE_OTP_SIZE}
        onPress={verifyOtp}>
        <View className="flex-row items-center gap-2">
          <Text className="text-[17px] font-extrabold tracking-tight text-white">
            ▶ Start Ride
          </Text>
        </View>
      </Button>
      <Text className="mt-2 text-center text-[11px] font-medium text-slate-500">
        Confirm the rider is in the vehicle before starting
      </Text>

      {/* resend otp */}
      <View className="mt-3 gap-y-4 hidden">
        <Button
          className="self-start rounded-full border-2 border-primary"
          variant={"outline"}
          onPress={resendOtp}
          disabled={timeLeft > 0 || !!loading}
        >
          <Text className='text-primary font-bold'>
            Resend Ride OTP
            {timeLeft > 0 ? ` (${ formattedTime })` : ""}
          </Text>
        </Button>
      </View>
      {loading && <View className="pointer-events-none absolute inset-0 items-center justify-center">
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text className="mt-3 text-sm font-medium text-slate-400">{ loading === 'start' ? "Starting" : "Sending"}…</Text>
      </View>}
    </Animated.View>
  );
}