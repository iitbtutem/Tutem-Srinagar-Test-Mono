import CustomDatePicker, { type CustomDatePickerHandle } from '@/components/DatePicker';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { useEffect, useRef } from 'react';
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
} from '@tutem/ui';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@tutem/api';
import { Redirect, useRouter } from 'expo-router';
import { GENDER } from '@/constants';
import { useToast } from '@/components/CustomToast';
import { useAuth } from '@clerk/expo';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useNotification } from '@/context/NotificationContext';

const formSchema = z.object({
  firstName: z
    .string('Enter a valid first name')
    .min(2, 'First name must be atleast 2 characters long.'),
  lastName: z.string('Enter a valid last name').optional(),
  gender: z.enum(GENDER, 'Select gender'),
  dob: z.date('Enter your DOB'),
  phoneNumber: z.string().min(1, 'Phone number is required').max(10, 'Invalid phone number'),
});

export default function Register() {
  const router = useRouter();
  const { userId } = useAuth();
  const { showToast } = useToast();
  const { expoPushToken } = useNotification();
  const lastNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const dobRef = useRef<CustomDatePickerHandle>(null);

  const addUser = useMutation(api.routes.rider.addRider);
  const registerExpoPushToken = useMutation(api.routes.rider.registerExpoPushToken);
  const rider = useQuery(api.routes.rider.getRider, { clerkId: userId ?? '' });

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
      phoneNumber: '',
    },
  });

  const onSubmit = handleSubmit(async (data: z.infer<typeof formSchema>) => {
    try {
      if (!userId) {
        showToast({ title: 'Error', description: 'User not found', type: 'error' });
        return;
      }

      await addUser({
        ...data,
        dob: String(data.dob),
        clerkId: userId,
        expoPushToken: expoPushToken ?? undefined,
      });

      showToast({ title: 'Success', description: 'Profile saved successfully', type: 'success' });

      router.replace('/(protected)/(tabs)');
    } catch (error) {
      showToast({ title: 'Error', description: 'Failed to save profile', type: 'error' });
    }
  });

  useEffect(() => {
    if (!userId || !rider || !expoPushToken) return;
    if (!rider.riderDetails) return;
    registerExpoPushToken({ riderId: rider.riderDetails._id, expoPushToken });
  }, []);

  if (rider === undefined) return <ActivityIndicator />;

  if (rider && userId) return <Redirect href="/" />;

  return (
      <Animated.ScrollView
        entering={FadeInRight.delay(300).duration(400)}
        className="flex-1 bg-background p-3 mt-6">
        <Text className="my-4 mb-2 text-lg font-semibold">Fill in your details</Text>
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
                  onSubmitEditing={() => phoneRef.current?.focus()}
                />
              )}
            />
            {errors.lastName && (
              <Text className="text-md text-destructive">{errors.lastName.message}</Text>
            )}
          </View>

          {/* Phone number */}
          <View>
            <View className="mb-1 flex-row items-center gap-1.5">
              <Feather name="phone" size={14} color="gray" />
              <Text className="text-sm font-medium text-muted-foreground">Mobile Number</Text>
            </View>
            <Controller
              name="phoneNumber"
              control={control}
              rules={{ required: true }}
              render={({ field: { onChange, value } }) => (
                <View className="relative">
                  <Input
                    ref={phoneRef}
                    inputMode="tel"
                    placeholder="9876543210"
                    maxLength={10}
                    onChangeText={onChange}
                    className="pl-14"
                    value={value}
                    returnKeyType="next"
                    onSubmitEditing={() => dobRef.current?.open()}
                  />
                  <Text className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    +91
                  </Text>
                </View>
              )}
            />
            {errors.phoneNumber && (
              <Text className="text-md text-destructive">{errors.phoneNumber.message}</Text>
            )}
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
                    title="Choose DOB"
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

          <Button onPress={onSubmit} className='my-4'>
            <Text>Submit</Text>
          </Button>
        </View>
      </Animated.ScrollView>
  );
}
