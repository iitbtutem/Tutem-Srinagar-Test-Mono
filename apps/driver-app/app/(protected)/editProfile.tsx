import CustomDatePicker, { type CustomDatePickerHandle } from '@/components/DatePicker';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Image, TextInput, TouchableOpacity, View } from 'react-native';
import LoadingScreen from '@/components/LoadingScreen';
import { useRef, useState } from 'react';
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
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { api } from '@tutem/api';
import type { Id } from '@tutem/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAction, useMutation, useQuery } from 'convex/react';
import { GENDER } from '@/constants';
import { useToast } from '@/components/CustomToast';
import ErrorScreen from '@/components/ErrorScreen';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colorScheme } from 'nativewind';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import { cn } from '@/lib/utils';
import { useFileUpload } from '@/hooks/useFileUpload';

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
  licenseImageFrontKey: z.string().optional(),
  licenseImageBackKey: z.string().optional(),
});

export default function EditProfile() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentFieldToUpdate, setCurrentFieldToUpdate] = useState<
    'licenseImageFrontKey' | 'licenseImageBackKey' | null
  >(null);
  const router = useRouter();
  const { showToast } = useToast();  
  const { uploadFile } = useFileUpload();

  const isDark = colorScheme.get() === 'dark';

  const { firstName, lastName, dob, phoneNumber, licenseNumber, gender, organizationId, clerkId } =
    useLocalSearchParams<{
      firstName: string;
      lastName?: string;
      dob: string;
      phoneNumber: string;
      licenseNumber?: string;
      gender: 'Male' | 'Female' | 'Other';
      organizationId: string;
      clerkId: string;
    }>();

  const lastNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const dobRef = useRef<CustomDatePickerHandle>(null);
  const licenseRef = useRef<TextInput>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const organizations = useQuery(api.routes.organizations.getAllOrganizations);
  const updateDriver = useMutation(api.routes.driver.updateDriver);

  const {
    handleSubmit,
    control,
    setValue,
    setError,
    clearErrors,
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

  const selectedOrgId = useWatch({
    control,
    name: 'organizationId',
  });
  const selectedOrganization = organizations?.find((org) => org._id === selectedOrgId);
  const requiresLicenseImage = selectedOrganization?.isLicenseVerficationRequired ?? false;

  const handlePick = async (source: 'camera' | 'gallery') => {
    bottomSheetRef.current?.close();
    if (!currentFieldToUpdate) return;

    let result;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted')
        return showToast({
          type: 'error',
          title: 'Permission needed',
          description: 'Camera permissions are required.',
        });
      result = await ImagePicker.launchCameraAsync({ quality: 0.3 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted')
        return showToast({
          type: 'error',
          title: 'Permission needed',
          description: 'Camera roll permissions are required.',
        });
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.3 });
    }

    if (result && !result.canceled) {
      clearErrors(currentFieldToUpdate);
      setValue(currentFieldToUpdate, result.assets[0].uri);
    }
    setCurrentFieldToUpdate(null);
  };

  const onSubmit = handleSubmit(async (data: z.infer<typeof formSchema>) => {
    try {
      if (requiresLicenseImage && (!data.licenseImageFrontKey || !data.licenseImageBackKey)) {
        if (!data.licenseImageFrontKey)
          setError('licenseImageFrontKey', { message: 'Front image required' });
        if (!data.licenseImageBackKey)
          setError('licenseImageBackKey', { message: 'Back image required' });
        showToast({
          title: 'Error',
          description: 'Please upload both front and back of your license',
          type: 'error',
        });
        return;
      }

      setIsSubmitting(true);

      showToast({ title: 'Info', description: `Uploading license images`, type: 'info' });

      const uploadedFrontKey = await uploadFile(data.licenseImageFrontKey, `licenses/${clerkId}-front`);
      const uploadedBackKey = await uploadFile(data.licenseImageBackKey, `licenses/${clerkId}-back`);
      const { dob, gender, ...rest } = data;
      await updateDriver({
        ...rest,
        clerkId: clerkId,
        organizationId: data.organizationId as Id<'organization'>,
        licenseImageFrontKey: uploadedFrontKey,
        licenseImageBackKey: uploadedBackKey,
      });

      showToast({ title: 'Success', description: 'Profile updated successfully', type: 'success' });

      router.replace('/profile');
    } catch (error) {
      showToast({ title: 'Error', description: 'Failed to update profile', type: 'error' });
    }
  });

  if (organizations === undefined) return <LoadingScreen message="Loading organizations..." />;

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
          {/* NEW wrapper */}
          <View className="my-4 mb-2 flex-row items-center px-3">
            <TouchableOpacity className="mr-2 flex-row items-center" onPress={() => router.back()}>
              <MaterialIcons
                name="keyboard-backspace"
                size={20}
                color={isDark ? 'white' : 'black'}
              />
            </TouchableOpacity>

            <Text className="text-lg font-semibold">Edit your details below</Text>
          </View>

          <View className="gap-3 px-3 pb-20 pt-2">
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
                            label:
                              organizations?.find((org) => org._id === field.value)?.name ||
                              field.value,
                          }
                        : undefined
                    }
                    value={
                      field.value
                        ? {
                            value: field.value,
                            label:
                              organizations?.find((org) => org._id === field.value)?.name ||
                              field.value,
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
                      disabled={true}
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

            {/* License Upload Buttons */}
            {requiresLicenseImage && (
              <View className="mb-2 mt-2 gap-4">
                {(['licenseImageFrontKey', 'licenseImageBackKey'] as const).map((fieldKey) => (
                  <View key={fieldKey}>
                    <Controller
                      control={control}
                      name={fieldKey}
                      render={({ field: { value, onChange } }) => (
                        <View className="items-start">
                          <View className="mb-1 flex-row items-center gap-1.5">
                            <Feather name="image" size={14} color="gray" />
                            <Text className="text-sm font-medium text-muted-foreground">
                              {fieldKey === 'licenseImageFrontKey'
                                ? 'Front of License'
                                : 'Back of License'}
                            </Text>
                          </View>
                          {value ? (
                            <View className="relative h-40 w-full rounded-lg bg-background shadow-black">
                              <Image
                                source={{ uri: value }}
                                className="h-full w-full rounded-lg"
                                resizeMode="cover"
                              />
                              <TouchableOpacity
                                disabled={isSubmitting}
                                className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 shadow-md"
                                onPress={() => onChange({ fileUri: undefined, uploadedKey: '' })}>
                                <MaterialIcons name="delete-outline" size={20} color="red" />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              disabled={isSubmitting}
                              className={cn(
                                'h-12 w-full flex-row items-center justify-center gap-4 rounded-lg border border-gray-300 bg-background'
                              )}
                              onPress={() => {
                                setCurrentFieldToUpdate(fieldKey);
                                bottomSheetRef.current?.expand();
                              }}>
                              <Feather name="upload" size={24} color="gray" />
                              <Text className="font-bold tracking-wider text-gray-500">
                                Select Image
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    />
                    {errors[fieldKey] && (
                      <Text className="text-md text-destructive">{errors[fieldKey].message}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            <Button onPress={onSubmit}>
              <Text>Submit</Text>
            </Button>
          </View>
        </Animated.View>
      </KeyboardAwareScrollView>
      <KeyboardToolbar />
      {/* Image Picker Bottom Sheet (Placed at root to avoid touch interference) */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['35%']}
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: isDark ? '#18181b' : '#FFFFFF' }}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#3f3f46' : '#E5E7EB' }}
        backdropComponent={(props: any) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}>
        <BottomSheetView className="gap-6 p-6">
          <Text className="text-center text-xl font-bold">Select Image Source</Text>

          <View className="flex-row justify-between">
            <TouchableOpacity
              className="mr-2 h-32 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-100 dark:border-zinc-800 dark:bg-zinc-900"
              onPress={() => handlePick('camera')}>
              <Feather name="camera" size={32} color={isDark ? '#a1a1aa' : 'gray'} />
              <Text className="font-semibold text-gray-600 dark:text-zinc-400">Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="ml-2 h-32 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-100 dark:border-zinc-800 dark:bg-zinc-900"
              onPress={() => handlePick('gallery')}>
              <Feather name="image" size={32} color={isDark ? '#a1a1aa' : 'gray'} />
              <Text className="font-semibold text-gray-600 dark:text-zinc-400">Gallery</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}
