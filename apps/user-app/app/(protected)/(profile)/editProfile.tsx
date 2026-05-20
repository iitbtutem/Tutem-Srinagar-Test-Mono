import CustomDatePicker, { type CustomDatePickerHandle } from '@/components/DatePicker';
import { TextInput, View } from 'react-native';
import { useRef } from 'react';
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
import { useMutation } from 'convex/react';
import { api } from '@tutem/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GENDER } from '@/constants';
import { useToast } from '@/components/CustomToast';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

const formSchema = z.object({
  firstName: z
    .string('Enter a valid first name')
    .min(2, 'First name must be atleast 2 characters long.'),
  lastName: z.string('Enter a valid last name').optional(),
  gender: z.enum(GENDER, 'Select gender'),
  dob: z.date('Enter your DOB'),
  phoneNumber: z.string().min(1, 'Phone number is required').max(10, 'Invalid phone number'),
});

export default function EditProfile() {
  const router = useRouter();
  const { showToast } = useToast();

  const { firstName, lastName, dob, phoneNumber, gender, clerkId } = useLocalSearchParams<{
    firstName: string;
    lastName?: string;
    dob: string;
    phoneNumber: string;
    gender: 'Male' | 'Female' | 'Other';
    clerkId: string;
  }>();

  const lastNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const dobRef = useRef<CustomDatePickerHandle>(null);

  const updateUser = useMutation(api.routes.rider.updateRider);

  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: firstName,
      lastName: lastName,
      dob: new Date(dob),
      gender: gender,
      phoneNumber: phoneNumber,
    },
  });

  const onSubmit = handleSubmit(async (data: z.infer<typeof formSchema>) => {
    try {
      const {dob, gender, ...rest} = data;
      await updateUser({ ...rest, clerkId: clerkId });

      showToast({ title: 'Success', description: 'Profile updated successfully', type: 'success' });

      router.replace('/profile');
    } catch (error) {
      showToast({ title: 'Error', description: 'Failed to update profile', type: 'error' });
    }
  });

  return (
    <Animated.ScrollView
      entering={FadeIn.delay(300).duration(400)}
      className="flex-1 bg-background p-3">
      <Text className="my-4 mb-2 text-lg font-semibold">Edit your details below</Text>
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
                <Text className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">+91</Text>
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
                  disabled={true}
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
              <Select
                defaultValue={
                  field.value
                    ? {
                        value: field.value,
                        label: field.value,
                      }
                    : undefined
                }
                value={
                  field.value
                    ? {
                        value: field.value,
                        label: field.value,
                      }
                    : undefined
                }
                onValueChange={(option: any) => field.onChange(option?.value)}>
                <SelectTrigger className="w-full" disabled={true}>
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

        <Button onPress={onSubmit}>
          <Text>Submit</Text>
        </Button>
      </View>
    </Animated.ScrollView>
  );
}
