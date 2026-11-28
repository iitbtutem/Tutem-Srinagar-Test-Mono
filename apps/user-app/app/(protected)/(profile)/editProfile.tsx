import { ScrollView, TextInput, View } from 'react-native';
import { useRef, useState } from 'react';
import { Text, Input, Button, Loader } from '@tutem/ui';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useAuthenticatedMutation } from '@/hooks/customApi';
import { api } from '@tutem/api';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { GENDER } from '@/constants';
import { useToast } from '@/components/CustomToast';
import { Feather } from '@expo/vector-icons';
import { BasicHeader } from '@/components/CustomHeader';
import { useAuth } from '@/hooks/useAuth';

const formSchema = z.object({
  firstName: z
    .string('Enter a valid first name')
    .min(2, 'First name must be atleast 2 characters long.'),
  lastName: z.string('Enter a valid last name').optional(),
  gender: z.enum(GENDER, 'Select gender'),
  dob: z.date('Enter your DOB'),
});

export default function EditProfile() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const { showToast } = useToast();

  const { firstName, lastName, dob, phoneNumber, gender } = useLocalSearchParams<{
    firstName: string;
    lastName?: string;
    dob: string;
    phoneNumber: string;
    gender: 'Male' | 'Female' | 'Other';
  }>();

  const { sessionToken } = useAuth();

  const lastNameRef = useRef<TextInput>(null);

  const updateUser = useAuthenticatedMutation(api.routes.rider.updateRider);

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
    },
  });

  const onSubmit = handleSubmit(async (data: z.infer<typeof formSchema>) => {
    if (!sessionToken) return;
    try {
      setIsSubmitting(true);
      const { dob, gender, ...rest } = data;

      await updateUser({ ...rest });

      showToast({ title: 'Success', description: 'Profile updated successfully', type: 'success' });

      router.back();
    } catch (error: any) {
      showToast({
        title: 'Error',
        description: error.data || 'Failed to update profile',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <ScrollView className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit Profile',
          header: (props) => <BasicHeader {...props} />,
        }}
      />

      {isSubmitting && <Loader subtitle="submitting..." />}
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
                returnKeyType="done"
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
              className="pl-14 pr-12 opacity-60"
            />
            <Text className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500/60">+91</Text>
            <View pointerEvents="none" className="absolute inset-y-0 right-3 justify-center">
              <Feather name="lock" size={18} color="gray" style={{ opacity: 0.4 }} />
            </View>
          </View>
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
                <View className="relative">
                  <Input
                    value={field.value?.toLocaleDateString()}
                    editable={false}
                    className="pr-12"
                  />
                  <View pointerEvents="none" className="absolute inset-y-0 right-3 justify-center">
                    <Feather name="lock" size={18} color="gray" style={{ opacity: 0.4 }} />
                  </View>
                </View>
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
              <View className="relative">
                <Input
                  value={field.value}
                  placeholder="Select Gender"
                  editable={false}
                  className="pr-12"
                />
                <View pointerEvents="none" className="absolute inset-y-0 right-3 justify-center">
                  <Feather name="lock" size={18} color="gray" style={{ opacity: 0.4 }} />
                </View>
              </View>
            )}
          />
          {errors.gender && (
            <Text className="text-md text-destructive">{errors.gender.message}</Text>
          )}
        </View>

        <Button onPress={onSubmit} className="my-3">
          <Text>Submit</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
