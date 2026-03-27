import CustomDatePicker, { type CustomDatePickerHandle } from '@/components/DatePicker';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { ActivityIndicator, TextInput, TouchableOpacity, View } from 'react-native';
import { useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { api } from '@tutem/api';
import type { Id } from '@tutem/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { GENDER } from '@/constants';
import { useToast } from '@/components/CustomToast';
import ErrorScreen from '@/components/ErrorScreen';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colorScheme } from 'nativewind';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';

const formSchema = z.object({
  firstName: z
    .string('Enter a valid first name')
    .min(2, 'First name must be atleast 2 characters long.'),
  lastName: z.string('Enter a valid last name').optional(),
  gender: z.enum(GENDER, 'Select gender'),
  dob: z.date('Enter your DOB'),
  licenseNumber: z
    .string('License number is required.')
    .min(14, 'Invalid license number')
    .max(20, 'Invalid license number'),
  organizationId: z.string().min(1, 'Select an organization.'),
  phoneNumber: z.string().min(1, 'Phone number is required').max(10, 'Invalid phone number'),
});

export default function EditProfile() {
  const router = useRouter();
  const { showToast } = useToast();
  const isDark = colorScheme.get() === 'dark';

  const { userId, firstName, lastName, dob, phoneNumber, licenseNumber, gender, organizationId, clerkId } = useLocalSearchParams<{
    firstName: string;
    lastName?: string;
    userId: string;
    dob: string;
    phoneNumber: string;
    licenseNumber?: string;
    gender: 'Male' | 'Female' | 'Other';
    organizationId: string;
    clerkId: string
  }>();



  const lastNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const dobRef = useRef<CustomDatePickerHandle>(null);
  const licenseRef = useRef<TextInput>(null);

  const organizations = useQuery(api.routes.organizations.getAllOrganizations);
  const updateUser = useMutation(api.routes.user.updateDriver);

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
      organizationId: organizationId,
      gender: gender,
      phoneNumber: phoneNumber,
      licenseNumber: licenseNumber,
    },
  });

  const onSubmit = handleSubmit(async (data: z.infer<typeof formSchema>) => {
    try {
      if (!userId) {
        showToast({ title: 'Error', description: 'User not found', type: 'error' });
        return;
      }

      await updateUser({ ...data, dob: String(data.dob), clerkId: clerkId, organizationId: data.organizationId as Id<"organization"> });

      showToast({ title: 'Success', description: 'Profile updated successfully', type: 'success' });

      router.replace('/(protected)/(tabs)/profile');
    } catch (error) {
      showToast({ title: 'Error', description: 'Failed to update profile', type: 'error' });
    }
  });

  if (organizations === undefined) return <ActivityIndicator />;

  if (organizations.length === 0) {
    return <ErrorScreen message="No organizations found" />;
  }

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        bottomOffset={62}
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, padding: 12 }}>
        <Animated.View entering={FadeIn.delay(300).duration(400)}>
          <TouchableOpacity
            className="flex-row items-center gap-1.5 self-start mb-2 mt-1"
            onPress={() => router.back()}>
            <MaterialIcons name="keyboard-backspace" size={20} color={isDark ? 'white' : 'black'} />
            <Text className="text-sm font-medium text-foreground opacity-90">Back</Text>
          </TouchableOpacity>

          <Text className="my-4 mb-2 text-lg font-semibold px-3">Edit your details below</Text>

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
                  placeholder="Virat"
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
              rules={{ required: true }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  ref={lastNameRef}
                  placeholder="Kholi"
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
                    ref={dobRef}
                    title="Choose DOB"
                    date={field.value}
                    setDate={(date) => {
                      field.onChange(date);
                      licenseRef.current?.focus();
                    }}
                  />
                  {fieldState.error && (
                    <Text className="text-md text-destructive">{fieldState.error.message}</Text>
                  )}
                </>
              )}
            />
          </View>

          {/* License number */}
          <View>
            <View className="mb-1 flex-row items-center gap-1.5">
              <Feather name="credit-card" size={14} color="gray" />
              <Text className="text-sm font-medium text-muted-foreground">License Number</Text>
            </View>
            <Controller
              control={control}
              rules={{ required: true }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  ref={licenseRef}
                  placeholder="DL-1234567890123"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  returnKeyType="done"
                  onSubmitEditing={() => onSubmit()}
                />
              )}
              name="licenseNumber"
            />
            {errors.licenseNumber && (
              <Text className="text-md text-destructive">{errors.licenseNumber.message}</Text>
            )}
          </View>

          {/* Organization */}
          <View>
            <View className="mb-1 flex-row items-center gap-1.5">
              <Feather name="briefcase" size={14} color="gray" />
              <Text className="text-sm font-medium text-muted-foreground">Organization</Text>
            </View>
            <Controller
              name="organizationId"
              control={control}
              render={({ field }) => (
                <Select
                  defaultValue={
                    field.value
                      ? {
                        value: field.value,
                        label: organizations?.find((org) => org._id === field.value)?.name || field.value,
                      }
                      : undefined
                  }
                  value={
                    field.value
                      ? {
                        value: field.value,
                        label: organizations?.find((org) => org._id === field.value)?.name || field.value,
                      }
                      : undefined
                  }
                  onValueChange={(option) => field.onChange(option?.value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Organization" />
                  </SelectTrigger>
                  <SelectContent className="w-10/12">
                    <SelectGroup>
                      <SelectLabel>Organization</SelectLabel>
                      {organizations.map((org) => (
                        <SelectItem key={org._id} label={org.name} value={org._id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.organizationId && (
              <Text className="text-md text-destructive">{errors.organizationId.message}</Text>
            )}
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
                  onValueChange={(option) => field.onChange(option?.value)}>
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


          <Button onPress={onSubmit}>
            <Text>Submit</Text>
          </Button>
        </View>
      </Animated.View>
      </KeyboardAwareScrollView>
      <KeyboardToolbar />
    </View>
  );
}
