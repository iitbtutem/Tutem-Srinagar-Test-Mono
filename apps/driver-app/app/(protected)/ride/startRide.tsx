import { useToast } from '@/components/CustomToast';
import { Text, Input, Button, Loader } from '@tutem/ui';
import { RIDE_OTP_TIMER_MINUTES } from '@/constants';
import { useCountdown } from '@/hooks/useCountdown';
import { useAuth } from '@/hooks/useAuth';
import { api, Id } from '@tutem/api';
import { useAction } from 'convex/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, TextInputKeyPressEvent, View } from 'react-native';
import { BasicHeader } from '@/components/CustomHeader';

const RIDE_OTP_SIZE = 4;

export default function startRide() {
  const { rideId, driverId } = useLocalSearchParams<{
    rideId: Id<'ride'>;
    driverId: Id<'driver'>;
  }>();

  const [inputArr, setInputArr] = useState<string[]>(new Array(RIDE_OTP_SIZE).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<'start' | 'resend' | null>(null);
  const { sessionToken } = useAuth();
  
  const { formattedTime, timeLeft, reset } = useCountdown({ initialTime: RIDE_OTP_TIMER_MINUTES * 60})
  const { showToast } = useToast();
  const inputRef = useRef<(TextInput | null)[]>([]);

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
    if (!driverId) {
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
      await startRide({ sessionToken: sessionToken || "", driverId, rideId, otp: Number(otp) });
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
      await generateRideOtp({ sessionToken: sessionToken || "", rideId })
      reset();
    } catch (error: any) {
      console.log(`error: ${error}`)
      showToast({
        type: "error",
        title: "Can't Resend OTP",
        description: error.data ?? "Failed to resend otp. Try Again"
      })
    }
  };

  return (
    <View className="flex-1 px-4 py-6 bg-background" >
      <Stack.Screen options={{ 
        headerShown: true,
        title: 'Start Ride',
        header: (props) => <BasicHeader {...props} />,
      }} />

      <Text className='text-center' variant={"title"}>Verify OTP</Text>

      <Text variant={"muted"} className='text-center mb-6'>
        Enter the {RIDE_OTP_SIZE}-digit code to start the ride.
      </Text>

      {loading && <Loader title={ loading === "start" ? "Start Ride" : undefined } subtitle={loading === "start" ? "Verifying OTP..." : "Sending OTP..."} />}
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
      <Text className="mt-3 text-center text-[11px] font-medium text-slate-500">
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
    </View>
  );
}