import CustomDatePicker, { type CustomDatePickerHandle } from '@/components/DatePicker';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { ActivityIndicator, TextInput, View } from 'react-native';
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
import { useMutation, useQuery } from 'convex/react';
import { api } from '@tutem/api';
import { Redirect, useRouter } from 'expo-router';
import { GENDER } from '@/constants';
import { useToast } from '@/components/CustomToast';
import { useAuth } from '@clerk/expo';
import ErrorScreen from '@/components/ErrorScreen';

const formSchema = z.object({
  firstName: z
    .string('Enter a valid first name')
    .min(2, 'First name must be atleast 2 characters long.'),
  lastName: z.string('Enter a valid last name').optional(),
  gender: z.enum(GENDER, 'Select gender'),
  dob: z.date('Enter your DOB'),
  licenseNumber: z.string('License number is required.').min(14, 'Invalid license number'),
  organizationId: z.string().min(1, 'Select an organization.'),
  phoneNumber: z.string().min(1, "Phone number is required").max(10, "Invalid phone number")
});

export default function Signup() {
  const router = useRouter();
  const { userId, signOut } = useAuth()
  const { showToast } = useToast();

  const lastNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const dobRef = useRef<CustomDatePickerHandle>(null);
  const licenseRef = useRef<TextInput>(null);

  const organizations = useQuery(api.routes.organizations.getAllOrganizations);
  const addUser = useMutation(api.routes.user.addDriver);
  const user = useQuery(api.routes.user.getUser, { clerkId: userId ?? "" })


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
      organizationId: '',
      gender: 'Male',
      phoneNumber: "",
    },
  });

  const onSubmit = handleSubmit(async (data: z.infer<typeof formSchema>) => {
    try {
      if (!userId) {
        showToast({ title: 'Error', description: 'User not found', type: 'error' });
        return;
      }

      await addUser({ ...data, dob: String(data.dob), clerkId: userId });

      showToast({ title: 'Success', description: 'Profile saved successfully', type: 'success' });

      // Navigate to the main app after profile completion
      router.replace('/(protected)/(tabs)');
    } catch (error) {
      showToast({ title: 'Error', description: 'Failed to save profile', type: 'error' });
    }
  });

  if (user === undefined) return <ActivityIndicator />

  if (user && userId) return <Redirect href="/" />

  if (organizations === undefined) return <ActivityIndicator />

  if (organizations.length === 0) {
    return <ErrorScreen message="No organizations found" />;
  }

  return (
    <View className="p-3">
      <Text className="my-4 text-lg font-semibold">Fill in your details</Text>
      <View className="gap-3 px-3 py-6">
        {/* First name  */}
        <Controller
          control={control}
          rules={{ required: true }}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="First name"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              returnKeyType="next"
              onSubmitEditing={() => lastNameRef.current?.focus()}
              blurOnSubmit={false}
            />
          )}
          name="firstName"
        />
        {errors.firstName && (
          <Text className="text-md text-destructive">{errors.firstName.message}</Text>
        )}

        {/* Last name */}
        <Controller
          name="lastName"
          control={control}
          rules={{ required: true }}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              ref={lastNameRef}
              placeholder="Last name"
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

        {/* Phone number */}
        <Controller
          name="phoneNumber"
          control={control}
          rules={{ required: true }}
          render={({ field: { onChange, value } }) => (
            <View className="relative">
              <Input
                ref={phoneRef}
                inputMode="tel"
                placeholder="Mobile number"
                maxLength={10}
                onChangeText={onChange}
                className=" pl-14 "
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

        <Controller
          name="dob"
          control={control}
          render={({ field, fieldState }) => (
            <>
              <CustomDatePicker
                ref={dobRef}
                title="Choose DOB"
                date={field.value}
                setDate={(date) => { field.onChange(date); licenseRef.current?.focus(); }}
              />

              {fieldState.error && (
                <Text className="text-md text-destructive">{fieldState.error.message}</Text>
              )}
            </>
          )}
        />

        {/* License number */}
        <Controller
          control={control}
          rules={{ required: true }}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              ref={licenseRef}
              placeholder="License Number"
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

        {/* Organizations Select */}
        <Controller
          name="organizationId"
          control={control}
          render={({ field }) => (
            <Select
              onValueChange={(option) => field.onChange(option?.value)}
              value={{
                label:
                  organizations.find((org) => org._id === field.value)?.name ??
                  'Select organization',
                value: field.value,
              }}>
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

        {/* Organizations Select */}
        <Controller
          name="gender"
          control={control}
          render={({ field }) => (
            <Select
              onValueChange={(option) => field.onChange(option?.value)}
              value={{ label: field.value, value: field.value }}>
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

        {errors.gender && <Text className="text-md text-destructive">{errors.gender.message}</Text>}

        <Button onPress={onSubmit}>
          <Text>Submit</Text>
        </Button>
      </View>

      <Button onPress={async () => await signOut()}>
        <Text>Logout</Text>
      </Button>
    </View>
  );
}
