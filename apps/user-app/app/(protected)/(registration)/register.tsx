import CustomDatePicker, { type CustomDatePickerHandle } from '@/components/DateTimePicker';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Text,
  Input,
  Button,
  Loader,
} from '@tutem/ui';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useAction } from 'convex/react';
import { useAuthenticatedMutation } from '@/hooks/customApi';
import { api } from '@tutem/api';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { GENDER } from '@/constants';
import { useToast } from '@/components/CustomToast';
import { useAuth } from '@/hooks/useAuth';
import { useRider } from '@/hooks/useRider';
import { Feather } from '@expo/vector-icons';
import { useNotification } from '@/context/NotificationContext';

const formSchema = z.object({
  firstName: z
    .string('Enter a valid first name')
    .min(2, 'First name must be atleast 2 characters long.'),
  lastName: z.string('Enter a valid last name').optional(),
  gender: z.enum(GENDER, 'Select gender'),
  dob: z.date('Enter your DOB'),
});

export default function Register() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { phoneNumber: phoneParam } = useLocalSearchParams<{ phoneNumber: string }>();

  const router = useRouter();
  const { phoneNumber: authPhone, signIn } = useAuth();
  const { showToast } = useToast();
  const { expoPushToken } = useNotification();
  const lastNameRef = useRef<TextInput>(null);
  const dobRef = useRef<CustomDatePickerHandle>(null);

  const addUser = useMutation(api.routes.rider.addRider);
  const registerExpoPushToken = useAuthenticatedMutation(api.routes.rider.registerExpoPushToken);
  const createSession = useAction(api.actions.auth.createSessionForUser);
  const { rider, isLoading: riderIsLoading } = useRider();

  console.log('in register screen');

  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      dob: undefined,
      gender: undefined,
    },
  });

  const phoneNumber = phoneParam ?? authPhone ?? '';

  const onSubmit = handleSubmit(async (data: z.infer<typeof formSchema>) => {
    try {
      if (!phoneNumber) {
        showToast({ title: 'Error', description: 'Phone number not found', type: 'error' });
        return;
      }

      setIsSubmitting(true);

      const convexUserId = await addUser({
        ...data,
        dob: String(data.dob),
        phoneNumber: phoneNumber,
        expoPushToken: expoPushToken ?? undefined,
      });

      const { sessionToken } = await createSession({
        userId: convexUserId,
        phoneNumber,
      });
      await signIn(sessionToken, phoneNumber);

      showToast({ title: 'Success', description: 'Profile saved successfully', type: 'success' });

      router.replace('/(protected)/(tabs)');
    } catch (error) {
      showToast({ title: 'Error', description: 'Failed to save profile', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  });

  useEffect(() => {
    if (!rider || !expoPushToken) return;
    if (!rider.riderDetails) return;
    registerExpoPushToken({ riderId: rider.riderDetails._id, expoPushToken });
  }, []);

  if (riderIsLoading === undefined) return <ActivityIndicator />;

  if (rider) return <Redirect href="/" />;

  return (
    <ScrollView className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      {isSubmitting && <Loader subtitle="Submitting..." />}

      <Text className="my-4 mb-2 px-3 text-lg font-semibold">Fill in your details</Text>
      <View className="gap-3 px-3 pb-20 pt-2">
        {/* First name */}
        <View>
          <View className="mb-1 flex-row items-center gap-1.5">
            <Feather name="user" size={14} color="gray" />
            <Text className="text-sm font-medium text-muted-foreground">First Name</Text>
          </View>
          <Controller
            control={control}
            rules={{ required: true }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="John"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                returnKeyType="next"
                onSubmitEditing={() => lastNameRef.current?.focus()}
              />
            )}
            name="firstName"
          />
          {errors.firstName && (
            <Text className="text-md text-destructive">{errors.firstName.message}</Text>
          )}
        </View>

        {/* Last name */}
        <View>
          <View className="mb-1 flex-row items-center gap-1.5">
            <Feather name="user" size={14} color="gray" />
            <Text className="text-sm font-medium text-muted-foreground">Last Name</Text>
          </View>
          <Controller
            name="lastName"
            control={control}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                ref={lastNameRef}
                placeholder="Doe"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                returnKeyType="next"
                onSubmitEditing={() => dobRef.current?.open()}
              />
            )}
          />
          {errors.lastName && (
            <Text className="text-md text-destructive">{errors.lastName.message}</Text>
          )}
        </View>

        {/* Phone number — pre-filled from auth, read-only */}
        <View>
          <View className="mb-1 flex-row items-center gap-1.5">
            <Feather name="phone" size={14} color="gray" />
            <Text className="text-sm font-medium text-muted-foreground">Mobile Number</Text>
          </View>
          <View className="relative">
            <Input
              inputMode="tel"
              value={phoneNumber}
              editable={false}
              className="pl-14 opacity-60"
            />
            <Text className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500/60">+91</Text>
          </View>
          <Text className="mt-1 text-xs text-muted-foreground">
            Phone number verified at sign-in
          </Text>
        </View>

        {/* DOB */}
        <View>
          <View className="mb-1 flex-row items-center gap-1.5">
            <Feather name="calendar" size={14} color="gray" />
            <Text className="text-sm font-medium text-muted-foreground">Date of Birth</Text>
          </View>
          <Controller
            name="dob"
            control={control}
            render={({ field, fieldState }) => (
              <>
                <CustomDatePicker
                  ref={dobRef}
                  placeholder="Choose DOB"
                  date={field.value}
                  setDate={(date) => {
                    field.onChange(date);
                  }}
                />
                {fieldState.error && (
                  <Text className="text-md text-destructive">{fieldState.error.message}</Text>
                )}
              </>
            )}
          />
        </View>

        {/* Gender */}
        <View>
          <View className="mb-1 flex-row items-center gap-1.5">
            <Feather name="users" size={14} color="gray" />
            <Text className="text-sm font-medium text-muted-foreground">Gender</Text>
          </View>
          <Controller
            name="gender"
            control={control}
            render={({ field }) => (
              <Select onValueChange={(option: any) => field.onChange(option?.value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Gender" />
                </SelectTrigger>
                <SelectContent className="w-10/12">
                  <SelectGroup>
                    <SelectLabel>Gender</SelectLabel>
                    {GENDER.map((gender) => (
                      <SelectItem key={gender} label={gender} value={gender}>
                        {gender}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
          {errors.gender && (
            <Text className="text-md text-destructive">{errors.gender.message}</Text>
          )}
        </View>

        <Button onPress={onSubmit} className="my-4">
          <Text>Submit</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
